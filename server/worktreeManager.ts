/**
 * Worktree lifecycle manager.
 *
 * Every operation that needs a scratch checkout (merges, agent commits, CI
 * runs) goes through this module so that:
 *
 *   - worktrees live under a single, predictable root
 *     (`$SOURCEHUB_DATA_DIR/worktrees`, else `~/.sourcehub/worktrees`) instead
 *     of being scattered across `/tmp`;
 *   - a worktree is always removed (and pruned) even when the operation
 *     throws;
 *   - leftovers from a crashed process are reclaimed at boot.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

export type WorktreePurpose = 'merge' | 'agent' | 'ci' | 'generic';

export interface WorktreeOptions {
  /** Label used in the directory name, e.g. `merge`, `agent`, `ci`. */
  purpose: WorktreePurpose | string;
  /** Ref (branch, tag or sha) to check out. */
  ref: string;
  /** Check out detached (default true) rather than as a branch. */
  detach?: boolean;
  /** Stable identifier of the owning repository (defaults to the repo dir name). */
  repoKey?: string;
}

export interface WorktreeHandle {
  /** Absolute path of the worktree checkout. */
  path: string;
  /** Unique id embedded in the directory name. */
  id: string;
}

export function getWorktreeRoot(): string {
  const dataDir = process.env.SOURCEHUB_DATA_DIR || path.join(os.homedir(), '.sourcehub');
  return path.join(dataDir, 'worktrees');
}

/** True when `candidate` lives inside the managed worktree root. */
export function isWorktreePath(candidate: string): boolean {
  const root = path.resolve(getWorktreeRoot());
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(root + path.sep);
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'repo';
}

export class WorktreeManager {
  private rootDir: string;

  constructor(rootDir: string = getWorktreeRoot()) {
    this.rootDir = rootDir;
  }

  get root(): string {
    return this.rootDir;
  }

  /** Absolute path a worktree with the given coordinates would occupy. */
  resolvePath(repoKey: string, purpose: string, id: string): string {
    return path.join(this.rootDir, sanitizeKey(repoKey), `${sanitizeKey(purpose)}-${id}`);
  }

  /**
   * Create a worktree for `ref` inside the managed root.
   * The caller is responsible for calling {@link remove} (or using
   * {@link withWorktree}) — but the returned path is always recorded so that
   * {@link cleanupStale} can reclaim it later.
   */
  async create(repoPath: string, options: WorktreeOptions): Promise<WorktreeHandle> {
    const id = crypto.randomBytes(4).toString('hex');
    const repoKey = options.repoKey || path.basename(path.resolve(repoPath));
    const worktreePath = this.resolvePath(repoKey, options.purpose, id);

    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    const args = ['worktree', 'add'];
    if (options.detach !== false) args.push('--detach');
    args.push(worktreePath, options.ref);

    try {
      await execFileAsync('git', args, {
        cwd: repoPath,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, LANG: 'en_US.UTF-8' },
      });
    } catch (err: any) {
      // Do not leave an empty directory behind when the checkout failed.
      await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Could not create worktree for ${options.ref}: ${err.stderr || err.message}`);
    }

    return { path: worktreePath, id };
  }

  /** Remove a worktree and prune the repository's worktree registry. */
  async remove(repoPath: string, worktreePath: string): Promise<void> {
    try {
      await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: repoPath,
        maxBuffer: 5 * 1024 * 1024,
      });
    } catch {
      // Fall back to a filesystem removal; the prune below clears the entry.
      await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
    await this.prune(repoPath);
  }

  /** Drop stale administrative entries for worktrees that no longer exist. */
  async prune(repoPath: string): Promise<void> {
    try {
      await execFileAsync('git', ['worktree', 'prune'], {
        cwd: repoPath,
        maxBuffer: 5 * 1024 * 1024,
      });
    } catch {
      /* best effort */
    }
  }

  /**
   * Run `fn` inside a fresh worktree and always clean it up afterwards.
   * This is the primary entry point for merge / agent / CI operations.
   */
  async withWorktree<T>(
    repoPath: string,
    options: WorktreeOptions,
    fn: (worktreePath: string) => Promise<T>
  ): Promise<T> {
    const handle = await this.create(repoPath, options);
    try {
      return await fn(handle.path);
    } finally {
      await this.remove(repoPath, handle.path);
    }
  }

  /**
   * Reclaim worktrees left behind by a crashed or killed process.
   * Registered worktrees that still exist on disk are left alone; directories
   * that are no longer registered are removed.
   */
  async cleanupStale(repoPath: string, repoKey?: string): Promise<string[]> {
    const removed: string[] = [];
    const key = sanitizeKey(repoKey || path.basename(path.resolve(repoPath)));

    // 1. Let git forget worktrees whose directory vanished.
    await this.prune(repoPath);

    // 2. Collect the worktrees git still knows about.
    const registered = new Set<string>();
    try {
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: repoPath,
        maxBuffer: 5 * 1024 * 1024,
      });
      for (const line of stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
          registered.add(path.resolve(line.substring('worktree '.length).trim()));
        }
      }
    } catch {
      return removed;
    }

    // 3. Delete leftover directories for this repository.
    const repoDir = path.join(this.rootDir, key);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(repoDir);
    } catch {
      return removed;
    }

    for (const entry of entries) {
      const full = path.join(repoDir, entry);
      if (registered.has(path.resolve(full))) continue;
      try {
        await fs.rm(full, { recursive: true, force: true });
        removed.push(full);
      } catch {
        /* best effort */
      }
    }

    await this.prune(repoPath);
    return removed;
  }
}

export const worktreeManager = new WorktreeManager();
