import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

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

export interface DiffFile {
  filename: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  path: string;
  events: string[];
  content: string;
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

export class GitService {
  private rootDir: string;

  constructor(rootDir: string = process.env.SOURCEHUB_REPOS_DIR || '/home/mrnicholas/Dev') {
    this.rootDir = rootDir;
  }

  getRepoPath(name: string): string {
    const cleanName = name.replace(/\.git$/, '');
    return path.join(this.rootDir, cleanName);
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
      owner: 'nicholas',
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

  async listBranches(name: string): Promise<string[]> {
    const repoPath = this.getRepoPath(name);
    const raw = await runGit(repoPath, ['branch', '-a', '--format=%(refname:short)']);
    return raw.split('\n').map(b => b.trim()).filter(Boolean);
  }

  async createBranch(name: string, branchName: string, baseBranch?: string): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const args = ['branch', branchName];
    if (baseBranch) args.push(baseBranch);
    await runGit(repoPath, args);
  }

  async getCommits(name: string, branch: string = 'HEAD', limit: number = 20): Promise<GitCommitEntry[]> {
    const repoPath = this.getRepoPath(name);
    try {
      let targetRef = branch;
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
      const rawDiff = await runGit(repoPath, ['diff', `${base}...${head}`]);
      if (!rawDiff) return [];

      const files: DiffFile[] = [];
      const fileChunks = rawDiff.split('diff --git ');

      for (const chunk of fileChunks) {
        if (!chunk.trim()) continue;
        const lines = chunk.split('\n');
        const header = lines[0]; // e.g. "a/file.txt b/file.txt"
        const filename = header.split(' ')[1]?.replace(/^b\//, '') || 'unknown';

        let additions = 0;
        let deletions = 0;
        const diffLines: DiffLine[] = [];

        let oldLine = 0;
        let newLine = 0;

        for (let i = 1; i < lines.length; i++) {
          const l = lines[i];
          if (l.startsWith('@@')) {
            const match = l.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
              oldLine = parseInt(match[1], 10);
              newLine = parseInt(match[2], 10);
            }
            continue;
          }
          if (l.startsWith('index ') || l.startsWith('--- ') || l.startsWith('+++ ') || l.startsWith('new file ') || l.startsWith('deleted file ')) {
            continue;
          }

          if (l.startsWith('+')) {
            additions++;
            diffLines.push({
              type: 'add',
              newLineNumber: newLine++,
              content: l.substring(1),
            });
          } else if (l.startsWith('-')) {
            deletions++;
            diffLines.push({
              type: 'delete',
              oldLineNumber: oldLine++,
              content: l.substring(1),
            });
          } else {
            diffLines.push({
              type: 'context',
              oldLineNumber: oldLine++,
              newLineNumber: newLine++,
              content: l.startsWith(' ') ? l.substring(1) : l,
            });
          }
        }

        files.push({
          filename,
          status: deletions > 0 && additions === 0 ? 'deleted' : additions > 0 && deletions === 0 ? 'added' : 'modified',
          additions,
          deletions,
          lines: diffLines,
        });
      }

      return files;
    } catch (e) {
      console.warn(`Could not compute diff for ${name} ${base}...${head}:`, e);
      return [];
    }
  }

  async mergePullRequest(
    name: string,
    targetBranch: string,
    sourceBranch: string,
    strategy: 'squash' | 'merge' | 'rebase' = 'squash',
    commitMessage?: string
  ): Promise<{ success: boolean; commitSha?: string; message: string }> {
    const repoPath = this.getRepoPath(name);
    try {
      // 1. Checkout target branch if not already on it
      const currentBranch = await this.getCurrentBranch(name);
      if (currentBranch !== targetBranch) {
        await runGit(repoPath, ['checkout', targetBranch]);
      }

      // 2. Perform merge based on strategy
      if (strategy === 'squash') {
        await runGit(repoPath, ['merge', '--squash', sourceBranch]);
        const msg = commitMessage || `Merge PR: ${sourceBranch} into ${targetBranch}`;
        await runGit(repoPath, ['commit', '-m', msg]);
      } else if (strategy === 'rebase') {
        await runGit(repoPath, ['rebase', sourceBranch]);
      } else {
        const msg = commitMessage || `Merge branch '${sourceBranch}' into ${targetBranch}`;
        await runGit(repoPath, ['merge', '--no-ff', sourceBranch, '-m', msg]);
      }

      const sha = await runGit(repoPath, ['rev-parse', 'HEAD']);
      return {
        success: true,
        commitSha: sha,
        message: `Successfully merged ${sourceBranch} into ${targetBranch} using ${strategy}`,
      };
    } catch (err: any) {
      try {
        await runGit(repoPath, ['merge', '--abort']);
      } catch {}
      throw new Error(`Merge failed: ${err.message}`);
    }
  }

  async getTree(name: string, ref: string = 'HEAD', subPath: string = ''): Promise<GitTreeEntry[]> {
    const repoPath = this.getRepoPath(name);
    try {
      let targetRef = ref;
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
    let targetRef = ref;
    try {
      await runGit(repoPath, ['rev-parse', '--verify', targetRef]);
    } catch {
      targetRef = 'HEAD';
    }
    return await runGit(repoPath, ['show', `${targetRef}:${filePath}`]);
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
    const repoPath = path.join(this.rootDir, cleanName);

    await fs.mkdir(repoPath, { recursive: true });
    await runGit(repoPath, ['init', '-b', 'main']);

    if (description) {
      await fs.writeFile(path.join(repoPath, '.git', 'description'), description, 'utf8');
    }

    const readmeContent = `# ${cleanName}\n\n${description || 'A new repository on SourceHub.'}\n`;
    await fs.writeFile(path.join(repoPath, 'README.md'), readmeContent, 'utf8');

    await runGit(repoPath, ['add', 'README.md']);
    await runGit(repoPath, ['commit', '-m', 'Initial commit']);

    const repo = await this.getRepository(cleanName);
    if (!repo) throw new Error('Failed to create repository');
    return repo;
  }

  // --- Smart HTTP Git Clone Handlers ---

  async handleGitInfoRefs(name: string, service: string, res: ServerResponse): Promise<void> {
    const repoPath = this.getRepoPath(name);
    const exists = await this.isGitRepo(repoPath);
    if (!exists) {
      res.statusCode = 404;
      res.end('Repository not found');
      return;
    }

    if (service !== 'git-upload-pack') {
      res.statusCode = 400;
      res.end('Only git-upload-pack is supported for read/clone operations');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-git-upload-pack-advertisement');
    res.setHeader('Cache-Control', 'no-cache');

    const serviceHeader = '# service=git-upload-pack\n';
    const hexLen = (serviceHeader.length + 4).toString(16).padStart(4, '0');
    res.write(`${hexLen}${serviceHeader}0000`);

    const child = spawn('git', ['upload-pack', '--stateless-rpc', '--advertise-refs', repoPath]);
    child.stdout.pipe(res);
    child.stderr.on('data', d => console.error('git upload-pack stderr:', d.toString()));
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
    req.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', d => console.error('git upload-pack execution stderr:', d.toString()));
  }
}
