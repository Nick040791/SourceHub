import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { assertValidRefname, assertValidSha, assertSafePositional } from './gitRefs';
import { resolveWithin, normalizeRepoRelative } from './pathSafety';
import { worktreeManager } from './worktreeManager';
import { identityArgs } from './operatorProfile';
import { isProtectedBranch, getProtectedBranches } from './repoSettings';

const execFileAsync = promisify(execFile);

export interface RepoSummary {
  id: string;
  name: string;
  path: string;
  owner: string;
  description: string;
  visibility: 'private' | 'public';
  defaultBranch: string;
  currentBranch: string;
  starsCount: number;
  forksCount: number;
  branches: string[];
  tags: string[];
  updatedAt: string;
  lastCommit?: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface GitTreeEntry {
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  name: string;
  path: string;
  size?: string;
  lastCommitMessage?: string;
  lastCommitDate?: string;
}

export interface GitCommitEntry {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  agentRunId?: string;
  trailer?: string;
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  patch: string;
}

export interface DiffFile {
  filename: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  lines: DiffLine[];
  hunks?: DiffHunk[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  path: string;
  events: string[];
  content: string;
}

export interface WorkingFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  oldPath?: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitStashEntry {
  index: number;
  message: string;
  date: string;
}

export interface WorkingCopyStatus {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  isClean: boolean;
  files: WorkingFile[];
  remotes: GitRemote[];
  lastFetched: string | null;
  stashes: GitStashEntry[];
}

export interface BlameLine {
  lineNumber: number;
  commitSha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  date: string;
  summary: string;
  content: string;
}

export function parsePorcelainBlame(rawOutput: string): BlameLine[] {
  if (!rawOutput) return [];
  const lines = rawOutput.split('\n');
  const result: BlameLine[] = [];
  const commitMetaMap = new Map<string, { author: string; authorEmail: string; timestamp: number; summary: string }>();

  let currentSha = '';
  let currentFinalLine = 0;
  let tempMeta = { author: '', authorEmail: '', timestamp: 0, summary: '' };

  for (const line of lines) {
    if (line.startsWith('\t')) {
      const content = line.substring(1);
      const meta = commitMetaMap.get(currentSha) || tempMeta;
      const dateStr = meta.timestamp ? new Date(meta.timestamp * 1000).toISOString() : '';
      result.push({
        lineNumber: currentFinalLine,
        commitSha: currentSha,
        shortSha: currentSha.substring(0, 7),
        author: meta.author || 'Unknown',
        authorEmail: meta.authorEmail || '',
        date: dateStr,
        summary: meta.summary || '',
        content,
      });
      continue;
    }

    const firstSpace = line.indexOf(' ');
    if (firstSpace === 40) {
      currentSha = line.substring(0, 40);
      const parts = line.substring(41).trim().split(/\s+/);
      currentFinalLine = parseInt(parts[1] || parts[0], 10) || 0;
      if (!commitMetaMap.has(currentSha)) {
        tempMeta = { author: '', authorEmail: '', timestamp: 0, summary: '' };
        commitMetaMap.set(currentSha, tempMeta);
      } else {
        tempMeta = commitMetaMap.get(currentSha)!;
      }
    } else if (line.startsWith('author ')) {
      tempMeta.author = line.substring(7).trim();
    } else if (line.startsWith('author-mail ')) {
      tempMeta.authorEmail = line.substring(12).trim().replace(/^<|>$/g, '');
    } else if (line.startsWith('author-time ')) {
      tempMeta.timestamp = parseInt(line.substring(12).trim(), 10) || 0;
    } else if (line.startsWith('summary ')) {
      tempMeta.summary = line.substring(8).trim();
    }
  }

  return result;
}

async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 15 * 1024 * 1024,
      env: { ...process.env, LANG: 'en_US.UTF-8' },
    });
    return stdout.trim();
  } catch (err: any) {
    throw new Error(`Git error (${args.join(' ')}): ${err.stderr || err.message}`);
  }
}

async function runGitSafe(repoPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 15 * 1024 * 1024,
      env: { ...process.env, LANG: 'en_US.UTF-8' },
    });
    return stdout;
  } catch (err: any) {
    if (err.stdout) {
      return err.stdout;
    }
    return '';
  }
}

export function parseUnifiedDiffString(rawDiff: string): DiffFile[] {
  if (!rawDiff) return [];
  const files: DiffFile[] = [];
  const fileChunks = rawDiff.split(/(?:^|\n)diff --git /).filter(Boolean);

  for (const chunk of fileChunks) {
    if (!chunk.trim()) continue;
    const rawLines = chunk.split('\n');
    const header = rawLines[0]; // e.g. "a/file.txt b/file.txt"
    const parts = header.trim().split(' ');
    const filename = (parts[1] || parts[0] || 'unknown').replace(/^[ab]\//, '');

    let additions = 0;
    let deletions = 0;
    const diffLines: DiffLine[] = [];
    const hunks: DiffHunk[] = [];

    let currentHunk: DiffHunk | null = null;
    let currentHunkRawLines: string[] = [];
    let oldLine = 0;
    let newLine = 0;

    const finalizeHunk = () => {
      if (currentHunk) {
        const patchHeader = `diff --git a/${filename} b/${filename}\n--- a/${filename}\n+++ b/${filename}\n${currentHunk.header}\n`;
        currentHunk.patch = patchHeader + currentHunkRawLines.join('\n') + '\n';
        hunks.push(currentHunk);
        currentHunk = null;
        currentHunkRawLines = [];
      }
    };

    for (let i = 1; i < rawLines.length; i++) {
      const l = rawLines[i];
      if (l.startsWith('@@')) {
        finalizeHunk();
        const match = l.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        const oldStart = match ? parseInt(match[1], 10) : 1;
        const oldCnt = match && match[2] !== undefined ? parseInt(match[2], 10) : 1;
        const newStart = match ? parseInt(match[3], 10) : 1;
        const newCnt = match && match[4] !== undefined ? parseInt(match[4], 10) : 1;

        oldLine = oldStart;
        newLine = newStart;

        currentHunk = {
          header: l,
          oldStart,
          oldLines: oldCnt,
          newStart,
          newLines: newCnt,
          lines: [],
          patch: '',
        };
        continue;
      }

      if (
        l.startsWith('index ') ||
        l.startsWith('--- ') ||
        l.startsWith('+++ ') ||
        l.startsWith('new file ') ||
        l.startsWith('deleted file ') ||
        l.startsWith('old mode ') ||
        l.startsWith('new mode ') ||
        l.startsWith('similarity index ')
      ) {
        continue;
      }

      if (l.startsWith('\\ No newline at end of file')) {
        if (currentHunk) {
          currentHunkRawLines.push(l);
        }
        continue;
      }

      if (!currentHunk) {
        continue;
      }

      currentHunkRawLines.push(l);

      if (l.startsWith('+')) {
        additions++;
        const lineObj: DiffLine = {
          type: 'add',
          newLineNumber: newLine++,
          content: l.substring(1),
        };
        diffLines.push(lineObj);
        currentHunk.lines.push(lineObj);
      } else if (l.startsWith('-')) {
        deletions++;
        const lineObj: DiffLine = {
          type: 'delete',
          oldLineNumber: oldLine++,
          content: l.substring(1),
        };
        diffLines.push(lineObj);
        currentHunk.lines.push(lineObj);
      } else if (l.startsWith(' ')) {
        const lineObj: DiffLine = {
          type: 'context',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          content: l.substring(1),
        };
        diffLines.push(lineObj);
        currentHunk.lines.push(lineObj);
      } else if (!l) {
        continue;
      } else {
        const lineObj: DiffLine = {
          type: 'context',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          content: l,
        };
        diffLines.push(lineObj);
        currentHunk.lines.push(lineObj);
      }
    }

    finalizeHunk();

    files.push({
      filename,
      status:
        deletions > 0 && additions === 0
          ? 'deleted'
          : additions > 0 && deletions === 0
          ? 'added'
          : 'modified',
      additions,
      deletions,
      lines: diffLines,
      hunks,
    });
  }

  return files;
}

export class GitService {
  private rootDir: string;

  constructor(rootDir: string = process.env.SOURCEHUB_REPOS_DIR || path.join(process.env.HOME || '', 'Dev')) {
    this.rootDir = rootDir;
  }

  getRepoPath(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('Repository name is required');
    }
    const cleanName = name.replace(/\.git$/, '').trim();
    if (cleanName.includes('..') || cleanName.includes('/') || cleanName.includes('\\')) {
      throw new Error('Invalid repository name: path traversal characters detected');
    }
    const normalizedRoot = path.resolve(this.rootDir);
    const resolved = path.resolve(normalizedRoot, cleanName);
    if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
      throw new Error('Invalid repository path: outside root directory');
    }
    return resolved;
  }

  async listRepositories(): Promise<RepoSummary[]> {
    const repos: RepoSummary[] = [];
    try {
      const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const repoPath = path.join(this.rootDir, entry.name);
        const isRepo = await this.isGitRepo(repoPath);
        if (!isRepo) continue;

        try {
          const info = await this.getRepository(entry.name);
          if (info) repos.push(info);
        } catch (e) {
          console.error(`Failed to inspect repo ${entry.name}:`, e);
        }
      }
    } catch (err) {
      console.error('Error listing root directory:', err);
    }
    return repos;
  }

  async isGitRepo(targetPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(targetPath, '.git');
      const stat = await fs.stat(gitDir);
      return stat.isDirectory() || stat.isFile();
    } catch {
      try {
        const headFile = path.join(targetPath, 'HEAD');
        const stat = await fs.stat(headFile);
        return stat.isFile();
      } catch {
        return false;
      }
    }
  }

  async getRepository(name: string): Promise<RepoSummary | null> {
    const repoPath = this.getRepoPath(name);
    const exists = await this.isGitRepo(repoPath);
    if (!exists) return null;

    let currentBranch = 'main';
    try {
      currentBranch = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {}

    let branches: string[] = [];
    try {
      const rawBranches = await runGit(repoPath, ['branch', '--list', '--format=%(refname:short)']);
      branches = rawBranches.split('\n').map(b => b.trim()).filter(Boolean);
    } catch {}

    if (branches.length === 0) branches = [currentBranch];

    let tags: string[] = [];
    try {
      const rawTags = await runGit(repoPath, ['tag', '--list']);
      tags = rawTags.split('\n').map(t => t.trim()).filter(Boolean);
    } catch {}

    let lastCommit: RepoSummary['lastCommit'] | undefined;
    let updatedAt = 'recently';

    try {
      const logOut = await runGit(repoPath, [
        'log',
        '-1',
        '--format=%H|%h|%s|%an|%cr',
      ]);
      if (logOut) {
        const [sha, shortSha, message, author, relDate] = logOut.split('|');
        lastCommit = { sha, shortSha, message, author, date: relDate };
        updatedAt = relDate;
      }
    } catch {}

    let description = 'Self-hosted git repository on SourceHub.';
    try {
      const descPath = path.join(repoPath, '.git', 'description');
      const desc = await fs.readFile(descPath, 'utf8');
      if (desc && !desc.includes('Unnamed repository')) {
        description = desc.trim();
      }
    } catch {}

    const defaultBranch = branches.includes('main') ? 'main' : branches.includes('master') ? 'master' : branches[0] || 'main';

    return {
      id: `repo-${name}`,
      name,
      path: repoPath,
      owner: 'operator',
      description,
      visibility: 'private',
      defaultBranch,
      currentBranch,
      starsCount: 1,
      forksCount: 0,
      branches,
      tags,
      updatedAt,
      lastCommit,
    };
  }

  async getCurrentBranch(name: string): Promise<string> {
    const repoPath = this.getRepoPath(name);
    try {
      return (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    } catch {
      return 'main';
    }
  }

  /**
   * True when a local branch with that name exists.
   * `getCommits` falls back to HEAD for unknown refs, so it cannot be used
   * to validate a branch name.
   */
  async branchExists(name: string, branch: string): Promise<boolean> {
    const repoPath = this.getRepoPath(name);
    try {
      assertValidRefname(branch, 'branch name');
      await runGit(repoPath, ['rev-parse', '--verify', `refs/heads/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  async listBranches(name: string): Promise<string[]> {
    const repoPath = this.getRepoPath(name);
    const raw = await runGit(repoPath, ['branch', '-a', '--format=%(refname:short)']);
    return raw.split('\n').map(b => b.trim()).filter(Boolean);
  }

  /**
   * Create a branch without checking it out.
   * Branch names are validated before they reach git: `git branch -D main`
   * would otherwise delete a branch.
   */
  async createBranch(name: string, branchName: string, baseBranch?: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(branchName, 'branch name');
    const args = ['branch', '--'];
    args.push(branchName);
    if (baseBranch) {
      assertValidRefname(baseBranch, 'base branch name');
      args.push(baseBranch);
    }
    await runGit(repoPath, args);
  }

  async getCommits(name: string, branch: string = 'HEAD', limit: number = 20): Promise<GitCommitEntry[]> {
    const repoPath = this.getRepoPath(name);
    try {
      let targetRef = assertValidRefname(branch, 'branch name');
      try {
        await runGit(repoPath, ['rev-parse', '--verify', targetRef]);
      } catch {
        targetRef = 'HEAD';
      }

      const format = '%H|%h|%s|%an|%ae|%cr|%(trailers:key=SourceHub-Agent-Run,valueonly=true)';
      const raw = await runGit(repoPath, [
        'log',
        `-${limit}`,
        `--format=${format}`,
        targetRef,
      ]);

      if (!raw) return [];

      return raw.split('\n').filter(Boolean).map(line => {
        const [sha, shortSha, message, author, authorEmail, date, agentRunId] = line.split('|');
        return {
          sha,
          shortSha,
          message,
          author,
          authorEmail,
          date,
          agentRunId: agentRunId ? agentRunId.trim() : undefined,
          trailer: agentRunId ? `SourceHub-Agent-Run: ${agentRunId.trim()}` : undefined,
        };
      });
    } catch (e) {
      console.warn(`Could not get commits for ${name} (${branch}):`, e);
      return [];
    }
  }

  async getCommitsBetween(name: string, base: string, head: string): Promise<GitCommitEntry[]> {
    const repoPath = this.getRepoPath(name);
    try {
      assertValidRefname(base, 'base branch name');
      assertValidRefname(head, 'head branch name');
      const format = '%H|%h|%s|%an|%ae|%cr|%(trailers:key=SourceHub-Agent-Run,valueonly=true)';
      const raw = await runGit(repoPath, [
        'log',
        `--format=${format}`,
        `${base}..${head}`,
      ]);

      if (!raw) return [];

      return raw.split('\n').filter(Boolean).map(line => {
        const [sha, shortSha, message, author, authorEmail, date, agentRunId] = line.split('|');
        return {
          sha,
          shortSha,
          message,
          author,
          authorEmail,
          date,
          agentRunId: agentRunId ? agentRunId.trim() : undefined,
          trailer: agentRunId ? `SourceHub-Agent-Run: ${agentRunId.trim()}` : undefined,
        };
      });
    } catch (e) {
      console.warn(`Could not get commits between ${base}..${head}:`, e);
      return [];
    }
  }

  async getBranchDiff(name: string, base: string, head: string): Promise<DiffFile[]> {
    const repoPath = this.getRepoPath(name);
    try {
      assertValidRefname(base, 'base branch name');
      assertValidRefname(head, 'head branch name');
      const rawDiff = await runGitSafe(repoPath, ['diff', `${base}...${head}`]);
      return parseUnifiedDiffString(rawDiff);
    } catch (e) {
      console.warn(`Could not compute diff for ${name} ${base}...${head}:`, e);
      return [];
    }
  }

  /**
   * Merge a source branch into a target branch.
   *
   * The merge always happens inside an isolated worktree so the operator's
   * working copy is never touched. The target ref is then moved with a
   * compare-and-swap update, so a branch that changed while the merge was
   * being prepared is never silently overwritten.
   */
  async mergePullRequest(
    name: string,
    targetBranch: string,
    sourceBranch: string,
    strategy: 'squash' | 'merge' | 'rebase' = 'squash',
    commitMessage?: string,
    options: { expectedBaseSha?: string } = {}
  ): Promise<{
    success: boolean;
    commitSha?: string;
    strategy: string;
    warnings: string[];
    message: string;
  }> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(targetBranch, 'target branch name');
    assertValidRefname(sourceBranch, 'source branch name');

    if (targetBranch === sourceBranch) {
      throw new Error('Source and target branches are identical.');
    }

    const warnings: string[] = [];

    // 1. Record the target tip so the ref update can be made atomic.
    let baseSha: string;
    try {
      baseSha = (await runGit(repoPath, ['rev-parse', targetBranch])).trim();
    } catch {
      throw new Error(`Target branch '${targetBranch}' does not exist.`);
    }
    if (options.expectedBaseSha && options.expectedBaseSha !== baseSha) {
      throw new Error(
        `Target branch '${targetBranch}' changed since the merge was prepared. Review the latest changes and try again.`
      );
    }

    try {
      await runGit(repoPath, ['rev-parse', '--verify', sourceBranch]);
    } catch {
      throw new Error(`Source branch '${sourceBranch}' does not exist.`);
    }

    const identity = identityArgs();

    // Inspect the main worktree *before* the ref moves: after the update the
    // working tree would look dirty simply because of the merge itself.
    let advanceMainWorktree = false;
    let mainWorktreeHasChanges = false;
    try {
      const currentBranch = await this.getCurrentBranch(name);
      if (currentBranch === targetBranch) {
        mainWorktreeHasChanges =
          (await runGit(repoPath, ['status', '--porcelain'])).trim().length > 0;
        advanceMainWorktree = !mainWorktreeHasChanges;
      }
    } catch {}

    // 2. Work in an isolated worktree.
    //    - squash / merge: detached at the target branch
    //    - rebase: detached at the source branch (rebasing rewrites the
    //      source commits, so the source branch itself stays untouched)
    const handle = await worktreeManager.create(repoPath, {
      purpose: 'merge',
      ref: strategy === 'rebase' ? sourceBranch : targetBranch,
      detach: true,
      repoKey: name,
    });

    try {
      let sha = '';

      if (strategy === 'squash') {
        await runGit(handle.path, ['merge', '--squash', sourceBranch]);
        const staged = await runGit(handle.path, ['status', '--porcelain']);
        if (!staged.trim()) {
          throw new Error(
            'Nothing to merge — the source branch has no changes relative to the target branch.'
          );
        }
        const msg = commitMessage || `Merge PR: ${sourceBranch} into ${targetBranch}`;
        await runGit(handle.path, [...identity, 'commit', '-m', msg]);
        sha = (await runGit(handle.path, ['rev-parse', 'HEAD'])).trim();
      } else if (strategy === 'rebase') {
        await runGit(handle.path, ['rebase', targetBranch]);
        sha = (await runGit(handle.path, ['rev-parse', 'HEAD'])).trim();
        if (!(await this.isAncestor(repoPath, targetBranch, sha))) {
          throw new Error(
            'Rebase produced a history that does not fast-forward the target branch. Merge aborted.'
          );
        }
      } else {
        const msg = commitMessage || `Merge branch '${sourceBranch}' into ${targetBranch}`;
        await runGit(handle.path, [
          ...identity,
          'merge',
          '--no-ff',
          sourceBranch,
          '-m',
          msg,
        ]);
        sha = (await runGit(handle.path, ['rev-parse', 'HEAD'])).trim();
      }

      // 3. Move the target branch atomically.
      await this.updateRefChecked(repoPath, `refs/heads/${targetBranch}`, sha, baseSha);

      // 4. Advance the main worktree when that is safe.
      if (advanceMainWorktree) {
        try {
          await runGit(repoPath, ['reset', '--hard', sha]);
        } catch {}
      } else if (mainWorktreeHasChanges) {
        warnings.push(
          `The working copy has uncommitted changes, so it was left untouched. Run "git reset --hard ${sha.slice(0, 7)}" to sync it with the merge.`
        );
      }

      return {
        success: true,
        commitSha: sha,
        strategy,
        warnings,
        message: `Successfully merged ${sourceBranch} into ${targetBranch} using ${strategy}`,
      };
    } catch (err: any) {
      await this.abortMergeInWorktree(handle.path);
      throw new Error(`Merge failed: ${err.message}`);
    } finally {
      await worktreeManager.remove(repoPath, handle.path);
    }
  }

  /** True when `ancestor` is reachable from `descendant`. */
  private async isAncestor(repoPath: string, ancestor: string, descendant: string): Promise<boolean> {
    try {
      await execFileAsync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
        cwd: repoPath,
        maxBuffer: 1024 * 1024,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update a ref only when it still points at `expectedOldSha`.
   * Prevents a concurrent branch move from being silently overwritten.
   */
  private async updateRefChecked(
    repoPath: string,
    ref: string,
    newSha: string,
    expectedOldSha: string
  ): Promise<void> {
    try {
      await runGit(repoPath, ['update-ref', ref, newSha, expectedOldSha]);
    } catch (err: any) {
      throw new Error(
        `Could not update ${ref}: the branch moved while the merge was running. Review the latest changes and try again. (${
          err.stderr || err.message
        })`
      );
    }
  }

  /** Abort an in-progress merge or rebase inside a worktree. */
  private async abortMergeInWorktree(worktreePath: string): Promise<void> {
    try {
      const gitDir = path.join(worktreePath, '.git');
      let resolvedGitDir = gitDir;
      try {
        const stat = await fs.stat(gitDir);
        if (stat.isFile()) {
          const content = await fs.readFile(gitDir, 'utf8');
          const match = content.match(/gitdir:\s*(.+)/);
          if (match) resolvedGitDir = match[1].trim();
        }
      } catch {}

      const hasRebaseState = await fs
        .stat(path.join(resolvedGitDir, 'rebase-merge'))
        .then(() => true)
        .catch(() => false) || (await fs
        .stat(path.join(resolvedGitDir, 'rebase-apply'))
        .then(() => true)
        .catch(() => false));

      if (hasRebaseState) {
        await runGitSafe(worktreePath, ['rebase', '--abort']);
      } else {
        await runGitSafe(worktreePath, ['merge', '--abort']);
      }
    } catch {}
  }

  /**
   * Check whether `head` can be merged into `base`.
   * Uses `git merge-tree` when available and falls back to a real merge
   * attempt in a throwaway worktree on older git versions.
   */
  async checkMergeConflict(
    name: string,
    base: string,
    head: string
  ): Promise<{ canMerge: boolean; conflictedFiles: string[] }> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(base, 'base branch name');
    assertValidRefname(head, 'head branch name');
    try {
      await execFileAsync('git', ['merge-tree', '--write-tree', '--messages', base, head], {
        cwd: repoPath,
        maxBuffer: 5 * 1024 * 1024,
      });
      return { canMerge: true, conflictedFiles: [] };
    } catch (err: any) {
      const output = `${err.stdout || ''}\n${err.stderr || ''}`;
      const conflictedFiles: string[] = [];
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/CONFLICT\s*\([^)]+\):\s*(?:Merge conflict in\s+)?([^\s\r\n]+)/i);
        if (match && match[1]) {
          const cleanPath = match[1].replace(/^[ "']+|[ "':]+$/g, '');
          if (cleanPath && !conflictedFiles.includes(cleanPath)) {
            conflictedFiles.push(cleanPath);
          }
        }
      }
      if (conflictedFiles.length > 0) {
        return { canMerge: false, conflictedFiles };
      }
      // `git merge-tree` is unavailable (git < 2.38) or failed for another
      // reason — fall back to attempting the merge for real.
      return await this.checkMergeConflictByTrial(name, base, head);
    }
  }

  /** Determine mergeability by attempting the merge in a disposable worktree. */
  private async checkMergeConflictByTrial(
    name: string,
    base: string,
    head: string
  ): Promise<{ canMerge: boolean; conflictedFiles: string[] }> {
    const repoPath = this.getRepoPath(name);
    let handle: { path: string; id: string } | null = null;
    try {
      handle = await worktreeManager.create(repoPath, {
        purpose: 'merge-check',
        ref: base,
        detach: true,
        repoKey: name,
      });
      await runGit(handle.path, ['merge', '--no-commit', '--no-ff', head]);
      return { canMerge: true, conflictedFiles: [] };
    } catch {
      const conflictedFiles: string[] = [];
      if (handle) {
        try {
          const raw = await runGitSafe(handle.path, ['diff', '--name-only', '--diff-filter=U']);
          for (const file of raw.split('\n').map(f => f.trim()).filter(Boolean)) {
            if (!conflictedFiles.includes(file)) conflictedFiles.push(file);
          }
        } catch {}
      }
      return {
        canMerge: false,
        conflictedFiles:
          conflictedFiles.length > 0 ? conflictedFiles : ['Conflicting files detected'],
      };
    } finally {
      if (handle) {
        await this.abortMergeInWorktree(handle.path);
        await worktreeManager.remove(repoPath, handle.path);
      }
    }
  }

  async deleteBranch(name: string, branchName: string): Promise<boolean> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(branchName, 'branch name');

    if (isProtectedBranch(branchName)) {
      throw new Error(`Cannot delete protected branch '${branchName}'.`);
    }

    const currentBranch = await this.getCurrentBranch(name);
    if (currentBranch === branchName) {
      throw new Error(`Cannot delete currently active branch '${branchName}'. Switch to another branch first.`);
    }

    // A branch that is checked out in a worktree cannot be deleted either.
    const worktrees = await this.listWorktreeBranches(name);
    if (worktrees.includes(branchName)) {
      throw new Error(`Cannot delete branch '${branchName}' — it is checked out in a worktree.`);
    }

    await runGit(repoPath, ['branch', '-D', '--', branchName]);
    return true;
  }

  /** Branches currently checked out in one of the repository's worktrees. */
  async listWorktreeBranches(name: string): Promise<string[]> {
    const repoPath = this.getRepoPath(name);
    const branches: string[] = [];
    try {
      const raw = await runGitSafe(repoPath, ['worktree', 'list', '--porcelain']);
      for (const line of raw.split('\n')) {
        if (line.startsWith('branch ')) {
          branches.push(line.substring('branch '.length).trim().replace(/^refs\/heads\//, ''));
        }
      }
    } catch {}
    return branches;
  }

  async getTree(name: string, ref: string = 'HEAD', subPath: string = ''): Promise<GitTreeEntry[]> {
    const repoPath = this.getRepoPath(name);
    try {
      let targetRef = assertValidRefname(ref, 'ref');
      try {
        await runGit(repoPath, ['rev-parse', '--verify', targetRef]);
      } catch {
        targetRef = 'HEAD';
      }

      const target = subPath ? `${targetRef}:${subPath}` : targetRef;
      const raw = await runGit(repoPath, ['ls-tree', '-l', target]);
      if (!raw) return [];

      const lines = raw.split('\n').filter(Boolean);
      const entries: GitTreeEntry[] = [];

      for (const line of lines) {
        const tabParts = line.split('\t');
        if (tabParts.length < 2) continue;
        const filename = tabParts[1];
        const metaParts = tabParts[0].trim().split(/\s+/);
        const mode = metaParts[0];
        const type = metaParts[1] as 'blob' | 'tree' | 'commit';
        const sha = metaParts[2];
        const sizeRaw = metaParts[3];

        let size: string | undefined;
        if (sizeRaw && sizeRaw !== '-') {
          const bytes = parseInt(sizeRaw, 10);
          if (!isNaN(bytes)) {
            size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
          }
        }

        const relativeItemPath = subPath ? `${subPath}/${filename}` : filename;

        let lastCommitMessage = '';
        let lastCommitDate = '';
        try {
          const logRaw = await runGit(repoPath, [
            'log',
            '-1',
            '--format=%s|%cr',
            targetRef,
            '--',
            relativeItemPath,
          ]);
          if (logRaw) {
            const [msg, date] = logRaw.split('|');
            lastCommitMessage = msg;
            lastCommitDate = date;
          }
        } catch {}

        entries.push({
          mode,
          type,
          sha,
          name: filename,
          path: relativeItemPath,
          size,
          lastCommitMessage: lastCommitMessage || 'Initial commit',
          lastCommitDate: lastCommitDate || 'recently',
        });
      }

      entries.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'tree' ? -1 : 1;
      });

      return entries;
    } catch (e) {
      console.warn(`Could not get tree for ${name} at ${subPath}:`, e);
      return [];
    }
  }

  async getBlob(name: string, ref: string = 'HEAD', filePath: string): Promise<string> {
    const repoPath = this.getRepoPath(name);
    let targetRef = assertValidRefname(ref, 'ref');
    try {
      await runGit(repoPath, ['rev-parse', '--verify', targetRef]);
    } catch {
      targetRef = 'HEAD';
    }
    const safePath = this.toRepoRelativePath(repoPath, filePath);
    return await runGit(repoPath, ['show', `${targetRef}:${safePath}`]);
  }

  async getBlame(name: string, ref: string = 'HEAD', filePath: string): Promise<BlameLine[]> {
    const repoPath = this.getRepoPath(name);
    let targetRef = assertValidRefname(ref, 'ref');
    try {
      await runGit(repoPath, ['rev-parse', '--verify', targetRef]);
    } catch {
      targetRef = 'HEAD';
    }
    const safePath = this.toRepoRelativePath(repoPath, filePath);
    try {
      const raw = await runGit(repoPath, ['blame', '--porcelain', targetRef, '--', safePath]);
      return parsePorcelainBlame(raw);
    } catch (err: any) {
      console.warn(`Could not get blame for ${name} ${targetRef}:${filePath}:`, err.message);
      return [];
    }
  }

  /**
   * Convert a caller-supplied path into a repository-relative path.
   * Rejects anything that resolves outside the repository, so a request for
   * `../../etc/passwd` can never reach the filesystem or git plumbing.
   */
  private toRepoRelativePath(repoPath: string, filePath: string): string {
    const absolute = resolveWithin(repoPath, filePath, 'file path');
    const relative = path.relative(repoPath, absolute);
    if (!relative || relative.startsWith('..')) {
      throw new Error(`Invalid file path: ${JSON.stringify(String(filePath))}`);
    }
    return relative.split(path.sep).join('/');
  }

  async getAllTrackedFiles(name: string, ref: string = 'HEAD'): Promise<string[]> {
    const repoPath = this.getRepoPath(name);
    try {
      const out = await runGit(repoPath, ['ls-tree', '-r', '--name-only', assertValidRefname(ref, 'ref')]);
      return out.split('\n').map(s => s.trim()).filter(Boolean);
    } catch {
      try {
        const out = await runGit(repoPath, ['ls-files']);
        return out.split('\n').map(s => s.trim()).filter(Boolean);
      } catch {
        return [];
      }
    }
  }

  async getUnifiedDiff(name: string, base: string, head: string): Promise<string> {
    const repoPath = this.getRepoPath(name);
    try {
      assertValidRefname(base, 'base branch name');
      assertValidRefname(head, 'head branch name');
      return await runGit(repoPath, ['diff', `${base}...${head}`]);
    } catch {
      try {
        return await runGit(repoPath, ['diff', `${base}..${head}`]);
      } catch {
        return '';
      }
    }
  }

  async getRepoSnapshot(
    name: string,
    ref: string = 'HEAD',
    maxChars: number = 120000,
    prompt?: string
  ): Promise<{ fileTree: string[]; files: { path: string; content: string }[]; totalTracked: number }> {
    const allFiles = await this.getAllTrackedFiles(name, ref);
    const ignoredExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf',
      '.eot', '.mp4', '.mp3', '.wav', '.zip', '.tar', '.gz', '.pdf', '.bin',
      '.wasm', '.exe', '.so', '.dylib', '.map'
    ]);
    const ignoredFiles = new Set([
      'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.DS_Store'
    ]);

    const readableFiles = allFiles.filter(f => {
      const lower = f.toLowerCase();
      const base = path.basename(lower);
      if (ignoredFiles.has(base)) return false;
      const ext = path.extname(lower);
      if (ignoredExtensions.has(ext)) return false;
      if (lower.includes('.min.')) return false;
      return true;
    });

    // Score files for prompt relevance and architectural priority
    const keywords = prompt
      ? prompt
          .toLowerCase()
          .split(/[^a-z0-9_-]+/)
          .filter(k => k.length >= 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into'].includes(k))
      : [];

    const scoredFiles = readableFiles.map(filePath => {
      const lowerPath = filePath.toLowerCase();
      const baseName = path.basename(lowerPath);
      let score = 0;

      // Tier 1: Core project configuration and manifests
      if (baseName === 'package.json') score += 2000;
      else if (baseName === 'tsconfig.json') score += 1500;
      else if (baseName === 'readme.md') score += 1200;
      else if (baseName === 'vite.config.ts' || baseName === 'next.config.js') score += 1000;

      // Tier 2: Keyword matches from prompt against path / basename
      for (const kw of keywords) {
        if (baseName.includes(kw)) {
          score += 400;
        } else if (lowerPath.includes(kw)) {
          score += 150;
        }
      }

      // Tier 3: Core application code priority over configs/assets
      if (lowerPath.startsWith('src/') || lowerPath.startsWith('server/')) {
        score += 80;
      } else if (lowerPath.startsWith('lib/') || lowerPath.startsWith('app/')) {
        score += 50;
      }

      // Tier 4: Code files over non-code
      const ext = path.extname(lowerPath);
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(ext)) {
        score += 40;
      } else if (['.json', '.css', '.html', '.md', '.yml', '.yaml'].includes(ext)) {
        score += 20;
      }

      return { path: filePath, score };
    });

    // Sort descending by relevance score
    scoredFiles.sort((a, b) => b.score - a.score);

    const loadedFiles: { path: string; content: string }[] = [];
    let currentChars = 0;

    for (const item of scoredFiles) {
      if (currentChars >= maxChars) break;
      try {
        const content = await this.getBlob(name, ref, item.path);
        if (content && typeof content === 'string') {
          // If a single file is monstrous, cap it
          const trimmed = content.length > 20000 ? content.substring(0, 20000) + '\n... [truncated]' : content;
          loadedFiles.push({ path: item.path, content: trimmed });
          currentChars += trimmed.length;
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return {
      fileTree: allFiles,
      files: loadedFiles,
      totalTracked: allFiles.length,
    };
  }

  async detectWorkflows(name: string): Promise<WorkflowSummary[]> {
    const repoPath = this.getRepoPath(name);
    const workflows: WorkflowSummary[] = [];

    const candidateDirs = [
      path.join(repoPath, '.sourcehub', 'workflows'),
      path.join(repoPath, '.github', 'workflows'),
    ];

    for (const dir of candidateDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, 'utf8');

            const nameMatch = content.match(/name:\s*['"]?([^\n'"]+)['"]?/);
            const wfName = nameMatch ? nameMatch[1].trim() : file;

            const events: string[] = [];
            if (content.includes('push:')) events.push('push');
            if (content.includes('pull_request:')) events.push('pull_request');
            if (content.includes('workflow_dispatch:')) events.push('workflow_dispatch');
            if (content.includes('agent_run:')) events.push('agent_run');

            workflows.push({
              id: file,
              name: wfName,
              path: path.relative(repoPath, filePath),
              events: events.length > 0 ? events : ['push', 'pull_request'],
              content,
            });
          }
        }
      } catch {}
    }

    return workflows;
  }

  async createRepository(name: string, description: string = ''): Promise<RepoSummary> {
    const cleanName = name.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!cleanName) throw new Error('Invalid repository name');
    const repoPath = path.join(this.rootDir, cleanName);

    await fs.mkdir(repoPath, { recursive: true });
    await runGit(repoPath, ['init', '-b', 'main']);

    if (description) {
      await fs.writeFile(path.join(repoPath, '.git', 'description'), description, 'utf8');
    }

    const readmeContent = `# ${cleanName}\n\n${description || 'A new repository on SourceHub.'}\n`;
    await fs.writeFile(path.join(repoPath, 'README.md'), readmeContent, 'utf8');

    // An explicit identity is required: `git commit` fails on hosts that do
    // not have a global user.name / user.email configured.
    await runGit(repoPath, ['add', 'README.md']);
    await runGit(repoPath, [...identityArgs(), 'commit', '-m', 'Initial commit']);

    const repo = await this.getRepository(cleanName);
    if (!repo) throw new Error('Failed to create repository');
    return repo;
  }

  // --- Real Branch Modification via Git Worktrees ---

  /**
   * Commit a set of files onto a branch without touching the operator's
   * working copy. The files are written inside an isolated worktree that is
   * removed again as soon as the commit exists.
   */
  async commitFilesToBranch(
    name: string,
    branch: string,
    files: { path: string; content: string }[],
    message: string,
    author: string = 'Helper',
    trailer?: string
  ): Promise<{ commitSha: string; filesCommitted: string[] }> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(branch, 'branch name');

    const handle = await worktreeManager.create(repoPath, {
      purpose: 'agent',
      ref: branch,
      detach: false,
      repoKey: name,
    });

    try {
      // 1. Write all requested files into the worktree
      const committedPaths: string[] = [];
      for (const file of files) {
        const relative = normalizeRepoRelative(file.path);
        const fullPath = resolveWithin(handle.path, relative, 'file path');
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf8');
        committedPaths.push(relative);
      }

      // 2. Stage changes
      await runGit(handle.path, ['add', '-A']);

      // 3. Check if there are staged changes
      const status = await runGit(handle.path, ['status', '--porcelain']);
      if (!status.trim()) {
        const currentSha = await runGit(handle.path, ['rev-parse', 'HEAD']);
        return { commitSha: currentSha, filesCommitted: [] };
      }

      // 4. Build commit message with optional trailer
      let fullMessage = message.trim();
      if (trailer) {
        fullMessage += `\n\n${trailer.trim()}`;
      }

      // 5. Commit inside the worktree
      await runGit(handle.path, [
        '-c',
        `user.name=${author}`,
        '-c',
        'user.email=helper@sourcehub.local',
        'commit',
        '-m',
        fullMessage,
      ]);

      const sha = await runGit(handle.path, ['rev-parse', 'HEAD']);
      return { commitSha: sha, filesCommitted: committedPaths };
    } finally {
      // 6. Clean up the temporary worktree
      await worktreeManager.remove(repoPath, handle.path);
    }
  }

  // --- Smart HTTP Git Clone & Push Handlers ---

  /**
   * Install a `pre-receive` hook that refuses updates to protected branches.
   * This is how a local forge protects `main` from a direct `git push`,
   * exactly as a hosted forge does.
   */
  async ensureProtectedBranchHooks(repoPath: string): Promise<void> {
    const protectedBranches = getProtectedBranches();
    if (protectedBranches.length === 0) return;

    const gitDir = path.join(repoPath, '.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const hookPath = path.join(hooksDir, 'pre-receive');

    const pattern = protectedBranches.map(b => `refs/heads/${b}`).join('|');
    const script = `#!/bin/sh
# Installed by SourceHub - refuses pushes to protected branches.
while read oldrev newrev refname; do
  case "$refname" in
    ${pattern})
      echo "SourceHub: '$refname' is a protected branch and cannot be pushed to directly." >&2
      echo "SourceHub: open a pull request instead." >&2
      exit 1
      ;;
  esac
done
exit 0
`;

    try {
      const current = await fs.readFile(hookPath, 'utf8').catch(() => null);
      if (current === script) return;
      await fs.mkdir(hooksDir, { recursive: true });
      await fs.writeFile(hookPath, script, { mode: 0o755 });
      await fs.chmod(hookPath, 0o755).catch(() => {});
    } catch (e) {
      console.warn(`Could not install protected branch hook for ${repoPath}:`, (e as Error).message);
    }
  }

  async handleGitInfoRefs(name: string, service: string, res: ServerResponse): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const exists = await this.isGitRepo(repoPath);
    if (!exists) {
      res.statusCode = 404;
      res.end('Repository not found');
      return;
    }

    if (service !== 'git-upload-pack' && service !== 'git-receive-pack') {
      res.statusCode = 400;
      res.end('Only git-upload-pack and git-receive-pack are supported');
      return;
    }

    if (service === 'git-receive-pack') {
      await this.ensureProtectedBranchHooks(repoPath);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', `application/x-${service}-advertisement`);
    res.setHeader('Cache-Control', 'no-cache');

    const serviceHeader = `# service=${service}\n`;
    const hexLen = (serviceHeader.length + 4).toString(16).padStart(4, '0');
    res.write(`${hexLen}${serviceHeader}0000`);

    const command = service === 'git-receive-pack' ? 'receive-pack' : 'upload-pack';
    const child = spawn('git', [command, '--stateless-rpc', '--advertise-refs', repoPath]);
    child.on('error', err => {
      console.error(`git ${command} spawn error:`, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Git server error');
      }
    });
    child.stdout.pipe(res);
    child.stderr.on('data', d => console.error(`git ${command} stderr:`, d.toString()));
  }

  async handleGitUploadPack(name: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const exists = await this.isGitRepo(repoPath);
    if (!exists) {
      res.statusCode = 404;
      res.end('Repository not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
    res.setHeader('Cache-Control', 'no-cache');

    const child = spawn('git', ['upload-pack', '--stateless-rpc', repoPath]);
    child.on('error', err => {
      console.error('git upload-pack execution spawn error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Git server error');
      }
    });
    req.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', d => console.error('git upload-pack execution stderr:', d.toString()));
  }

  async handleGitReceivePack(name: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const exists = await this.isGitRepo(repoPath);
    if (!exists) {
      res.statusCode = 404;
      res.end('Repository not found');
      return;
    }

    await this.ensureProtectedBranchHooks(repoPath);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-git-receive-pack-result');
    res.setHeader('Cache-Control', 'no-cache');

    const child = spawn('git', ['receive-pack', '--stateless-rpc', repoPath]);
    child.on('error', err => {
      console.error('git receive-pack execution spawn error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Git server error');
      }
    });
    req.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', d => console.error('git receive-pack execution stderr:', d.toString()));
  }

  // ==========================================
  // §17 Desktop / Local Git Source Control
  // ==========================================

  async getWorkingCopyStatus(name: string): Promise<WorkingCopyStatus> {
    const repoPath = this.getRepoPath(name);
    const branch = await this.getCurrentBranch(name);
    const remotes = await this.getRemotes(name);
    const stashes = await this.listStashes(name);

    // 1. Working copy files via porcelain status
    const rawStatus = await runGitSafe(repoPath, ['status', '--porcelain=v1', '-uall']);
    const files: WorkingFile[] = [];

    if (rawStatus.trim()) {
      for (const line of rawStatus.split('\n')) {
        if (!line.trim()) continue;
        const x = line[0];
        const y = line[1];
        let rest = line.substring(3).trim();
        let oldPath: string | undefined;

        if (rest.includes(' -> ')) {
          const parts = rest.split(' -> ');
          oldPath = parts[0];
          rest = parts[1];
        }

        if (x === '?' && y === '?') {
          files.push({
            path: rest,
            status: 'untracked',
            staged: false,
          });
        } else {
          // Staged change
          if (x !== ' ' && x !== '?') {
            files.push({
              path: rest,
              status: x === 'A' ? 'added' : x === 'D' ? 'deleted' : x === 'R' ? 'renamed' : 'modified',
              staged: true,
              oldPath,
            });
          }
          // Unstaged change
          if (y !== ' ' && y !== '?') {
            files.push({
              path: rest,
              status: y === 'D' ? 'deleted' : 'modified',
              staged: false,
            });
          }
        }
      }
    }

    // 2. Upstream ahead / behind counts
    let ahead = 0;
    let behind = 0;
    let hasUpstream = false;
    let upstream: string | null = null;

    try {
      upstream = (await runGit(repoPath, ['rev-parse', '--abbrev-ref', '@{u}'])).trim();
      const counts = (await runGit(repoPath, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'])).trim().split(/\s+/);
      ahead = parseInt(counts[0], 10) || 0;
      behind = parseInt(counts[1], 10) || 0;
      hasUpstream = true;
    } catch {
      // Check if origin/branch exists
      try {
        await runGit(repoPath, ['rev-parse', '--verify', `origin/${branch}`]);
        const counts = (await runGit(repoPath, ['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`])).trim().split(/\s+/);
        ahead = parseInt(counts[0], 10) || 0;
        behind = parseInt(counts[1], 10) || 0;
        hasUpstream = true;
        upstream = `origin/${branch}`;
      } catch {
        // No upstream tracked; count commits ahead relative to default remote branch
        try {
          let defaultRemote = 'origin/main';
          try {
            await runGit(repoPath, ['rev-parse', '--verify', 'origin/main']);
          } catch {
            try {
              await runGit(repoPath, ['rev-parse', '--verify', 'origin/master']);
              defaultRemote = 'origin/master';
            } catch {
              defaultRemote = '';
            }
          }

          if (defaultRemote) {
            const counts = (await runGit(repoPath, ['rev-list', '--left-right', '--count', `HEAD...${defaultRemote}`])).trim().split(/\s+/);
            ahead = parseInt(counts[0], 10) || 0;
          } else {
            ahead = 0;
          }
        } catch {
          ahead = 0;
        }
        behind = 0;
        hasUpstream = false;
        upstream = null;
      }
    }

    // 3. Last fetched timestamp
    let lastFetched: string | null = null;
    try {
      const fetchHead = path.join(repoPath, '.git', 'FETCH_HEAD');
      const stat = await fs.stat(fetchHead);
      const diffMs = Date.now() - stat.mtimeMs;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) lastFetched = 'Just now';
      else if (diffMins < 60) lastFetched = `${diffMins}m ago`;
      else if (diffMins < 1440) lastFetched = `${Math.floor(diffMins / 60)}h ago`;
      else lastFetched = `${Math.floor(diffMins / 1440)}d ago`;
    } catch {
      lastFetched = null;
    }

    return {
      branch,
      upstream,
      ahead,
      behind,
      hasUpstream,
      isClean: files.length === 0,
      files,
      remotes,
      lastFetched,
      stashes,
    };
  }

  async getWorkingDiff(name: string, filePath: string, staged: boolean = false): Promise<DiffFile | null> {
    const repoPath = this.getRepoPath(name);
    try {
      // The path must stay inside the repository: `git diff --no-index` reads
      // arbitrary files when handed a path outside the work tree.
      const absolutePath = resolveWithin(repoPath, filePath, 'file path');
      const relativePath = path.relative(repoPath, absolutePath).split(path.sep).join('/');
      if (!relativePath) return null;

      // Check if file is untracked
      let isTracked = true;
      try {
        await runGit(repoPath, ['ls-files', '--error-unmatch', '--', relativePath]);
      } catch {
        isTracked = false;
      }

      let rawDiff = '';
      if (!isTracked) {
        rawDiff = await runGitSafe(repoPath, ['diff', '--no-index', '--', '/dev/null', relativePath]);
      } else if (staged) {
        rawDiff = await runGitSafe(repoPath, ['diff', '--cached', '--', relativePath]);
      } else {
        rawDiff = await runGitSafe(repoPath, ['diff', '--', relativePath]);
      }

      const diffs = parseUnifiedDiffString(rawDiff);
      if (diffs.length > 0) return diffs[0];

      // If empty diff but file is untracked, try reading it directly
      if (!isTracked) {
        try {
          const content = await fs.readFile(absolutePath, 'utf-8');
          const lines = content.split('\n');
          const diffLines: DiffLine[] = lines.map((l, i) => ({
            type: 'add' as const,
            newLineNumber: i + 1,
            content: l,
          }));
          const patch =
            `diff --git a/${relativePath} b/${relativePath}\n--- /dev/null\n+++ b/${relativePath}\n@@ -0,0 +1,${lines.length} @@\n` +
            lines.map(l => `+${l}`).join('\n') +
            '\n';

          return {
            filename: relativePath,
            status: 'added',
            additions: lines.length,
            deletions: 0,
            lines: diffLines,
            hunks: [
              {
                header: `@@ -0,0 +1,${lines.length} @@`,
                oldStart: 0,
                oldLines: 0,
                newStart: 1,
                newLines: lines.length,
                lines: diffLines,
                patch,
              },
            ],
          };
        } catch {}
      }

      return null;
    } catch (e) {
      console.warn(`Could not get working diff for ${filePath}:`, e);
      return null;
    }
  }

  /** Validate caller-supplied paths and convert them to repo-relative form. */
  private toRepoRelativePaths(repoPath: string, paths: string[]): string[] {
    return paths.map(p => this.toRepoRelativePath(repoPath, p));
  }

  async stageFiles(name: string, paths: string[]): Promise<void> {
    const repoPath = this.getRepoPath(name);
    if (!paths || paths.length === 0) return;
    await runGit(repoPath, ['add', '--', ...this.toRepoRelativePaths(repoPath, paths)]);
  }

  async unstageFiles(name: string, paths: string[]): Promise<void> {
    const repoPath = this.getRepoPath(name);
    if (!paths || paths.length === 0) return;
    await runGit(repoPath, ['restore', '--staged', '--', ...this.toRepoRelativePaths(repoPath, paths)]);
  }

  async stageAll(name: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGit(repoPath, ['add', '-A']);
  }

  async unstageAll(name: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGit(repoPath, ['restore', '--staged', '.']);
  }

  async discardFileChanges(name: string, filePath: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const relativePath = this.toRepoRelativePath(repoPath, filePath);
    let isTracked = true;
    try {
      await runGit(repoPath, ['ls-files', '--error-unmatch', '--', relativePath]);
    } catch {
      isTracked = false;
    }

    if (isTracked) {
      await runGitSafe(repoPath, ['restore', '--staged', '--worktree', '--', relativePath]);
    } else {
      await runGitSafe(repoPath, ['clean', '-f', '--', relativePath]);
    }
  }

  async discardSelectedChanges(name: string, files: string[]): Promise<void> {
    for (const file of files) {
      await this.discardFileChanges(name, file);
    }
  }

  async applyPatch(
    name: string,
    patch: string,
    options: { reverse?: boolean; cached?: boolean } = {}
  ): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const args = ['apply'];
    if (options.cached !== false) args.push('--cached');
    if (options.reverse) args.push('--reverse');
    args.push('-');

    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd: repoPath });
      let stderr = '';
      proc.on('error', reject);
      proc.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `git apply failed with exit code ${code}`));
      });
      proc.stdin.on('error', () => {});
      proc.stdin.write(patch);
      proc.stdin.end();
    });
  }

  async discardAllChanges(name: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGitSafe(repoPath, ['restore', '--staged', '--worktree', '.']);
    await runGitSafe(repoPath, ['clean', '-fd']);
  }

  async commitWorkingCopy(
    name: string,
    summary: string,
    description?: string,
    files?: string[]
  ): Promise<{ sha: string }> {
    const repoPath = this.getRepoPath(name);
    if (files && files.length > 0) {
      await runGit(repoPath, ['add', '--', ...this.toRepoRelativePaths(repoPath, files)]);
    } else {
      const stagedFiles = (await runGitSafe(repoPath, ['diff', '--cached', '--name-only'])).trim();
      if (!stagedFiles) {
        await runGit(repoPath, ['add', '-A']);
      }
    }

    const args = [...identityArgs(), 'commit', '-m', summary];
    if (description && description.trim()) {
      args.push('-m', description.trim());
    }

    await runGit(repoPath, args);
    const sha = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim();
    return { sha };
  }

  async undoLastCommit(name: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGit(repoPath, ['reset', '--soft', 'HEAD~1']);
  }

  async getRemotes(name: string): Promise<GitRemote[]> {
    const repoPath = this.getRepoPath(name);
    const raw = await runGitSafe(repoPath, ['remote', '-v']);
    const map = new Map<string, { fetchUrl: string; pushUrl: string }>();

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const remoteName = parts[0];
        const url = parts[1];
        const type = parts[2]; // '(fetch)' or '(push)'

        if (!map.has(remoteName)) {
          map.set(remoteName, { fetchUrl: url, pushUrl: url });
        }
        const entry = map.get(remoteName)!;
        if (type.includes('fetch')) entry.fetchUrl = url;
        if (type.includes('push')) entry.pushUrl = url;
      }
    }

    return Array.from(map.entries()).map(([remoteName, { fetchUrl, pushUrl }]) => ({
      name: remoteName,
      fetchUrl,
      pushUrl,
    }));
  }

  async addRemote(name: string, remoteName: string, url: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGit(repoPath, ['remote', 'add', remoteName, url]);
  }

  async setRemoteUrl(name: string, remoteName: string, url: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGit(repoPath, ['remote', 'set-url', remoteName, url]);
  }

  async removeRemote(name: string, remoteName: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    await runGit(repoPath, ['remote', 'remove', remoteName]);
  }

  async fetchRemote(name: string, remote: string = 'origin'): Promise<{ success: boolean; message: string }> {
    const repoPath = this.getRepoPath(name);
    try {
      const output = await runGit(repoPath, ['fetch', remote]);
      return { success: true, message: output || `Fetched ${remote} successfully.` };
    } catch (err: any) {
      throw new Error(`Fetch failed: ${err.message}`);
    }
  }

  async pullRemote(
    name: string,
    remote: string = 'origin',
    branch?: string
  ): Promise<{ success: boolean; message: string }> {
    const repoPath = this.getRepoPath(name);
    const targetBranch = branch || (await this.getCurrentBranch(name));
    try {
      const output = await runGit(repoPath, ['pull', remote, targetBranch]);
      return { success: true, message: output || `Pulled ${remote}/${targetBranch} successfully.` };
    } catch (err: any) {
      throw new Error(`Pull failed: ${err.message}`);
    }
  }

  async pushRemote(
    name: string,
    remote: string = 'origin',
    branch?: string,
    setUpstream: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    const repoPath = this.getRepoPath(name);
    const targetBranch = branch || (await this.getCurrentBranch(name));
    const args = ['push'];
    if (setUpstream) args.push('-u');
    args.push(remote, targetBranch);

    try {
      const output = await runGit(repoPath, args);
      return { success: true, message: output || `Pushed to ${remote}/${targetBranch} successfully.` };
    } catch (err: any) {
      throw new Error(`Push failed: ${err.message}`);
    }
  }

  async listStashes(name: string): Promise<GitStashEntry[]> {
    const repoPath = this.getRepoPath(name);
    const raw = await runGitSafe(repoPath, ['stash', 'list', '--format=%gd|%cr|%gs']);
    if (!raw.trim()) return [];

    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [ref, date, message] = line.split('|');
        const match = ref.match(/stash@\{(\d+)\}/);
        const index = match ? parseInt(match[1], 10) : 0;
        return { index, date: date || '', message: message || 'WIP on branch' };
      });
  }

  async manageStash(
    name: string,
    action: 'save' | 'pop' | 'drop',
    message?: string,
    index: number = 0
  ): Promise<void> {
    const repoPath = this.getRepoPath(name);
    if (action === 'save') {
      const msg = message || `Stash created from SourceHub at ${new Date().toLocaleTimeString()}`;
      await runGit(repoPath, ['stash', 'push', '-m', msg]);
    } else if (action === 'pop') {
      await runGit(repoPath, ['stash', 'pop', `stash@{${index}}`]);
    } else if (action === 'drop') {
      await runGit(repoPath, ['stash', 'drop', `stash@{${index}}`]);
    }
  }

  async switchBranch(name: string, branchName: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(branchName, 'branch name');
    await runGit(repoPath, ['checkout', branchName]);
  }

  async createAndSwitchBranch(name: string, branchName: string, baseBranch?: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    assertValidRefname(branchName, 'branch name');
    const args = ['checkout', '-b', branchName];
    if (baseBranch) {
      assertValidRefname(baseBranch, 'base branch name');
      args.push(baseBranch);
    }
    await runGit(repoPath, args);
  }
}
