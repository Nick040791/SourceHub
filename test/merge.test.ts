import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { GitService } from '../server/gitService';

const execFileAsync = promisify(execFile);

const IDENTITY = ['-c', 'user.name=SourceHub Test', '-c', 'user.email=test@sourcehub.local'];

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', [...IDENTITY, ...args], {
    cwd,
    maxBuffer: 5 * 1024 * 1024,
  });
  return stdout.trim();
}

async function writeFile(root: string, relPath: string, content: string): Promise<void> {
  const full = path.join(root, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
}

describe('GitService: merge engine', () => {
  let testRoot: string;
  let repoPath: string;
  const repoName = 'merge-fixture';
  let gitService: GitService;

  before(async () => {
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sourcehub-merge-'));
    repoPath = path.join(testRoot, repoName);
    await fs.mkdir(repoPath, { recursive: true });
    await git(repoPath, 'init', '-b', 'main');
    await writeFile(repoPath, 'README.md', 'base\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'Initial commit');

    gitService = new GitService(testRoot);
  });

  after(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  /**
   * Reset the fixture to a single "base" commit on main so every scenario
   * starts from a known common ancestor.
   */
  async function resetFixture(): Promise<void> {
    await git(repoPath, 'checkout', '--force', 'main');
    await git(repoPath, 'reset', '--hard', 'HEAD');
    for (const branch of ['feature', 'conflict', 'empty-feature']) {
      try {
        await git(repoPath, 'branch', '-D', branch);
      } catch {
        /* branch does not exist yet */
      }
    }
    await git(repoPath, 'clean', '-fd');
    await writeFile(repoPath, 'README.md', 'base\n');
    await git(repoPath, 'add', '-A');
    await git(repoPath, 'commit', '-m', 'base state', '--allow-empty');
  }

  test('squash merge collapses the source branch into a single commit', async () => {
    await resetFixture();
    await git(repoPath, 'checkout', '-b', 'feature');
    await writeFile(repoPath, 'feature.txt', 'feature content\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'add feature file');
    await git(repoPath, 'checkout', 'main');

    const before = await git(repoPath, 'rev-parse', 'main');
    const commitsBefore = parseInt(await git(repoPath, 'rev-list', '--count', 'main'), 10);
    const result = await gitService.mergePullRequest(repoName, 'main', 'feature', 'squash');

    assert.equal(result.success, true);
    assert.ok(result.commitSha);
    assert.equal(result.strategy, 'squash');
    assert.notEqual(result.commitSha, before);

    const commitsAfter = parseInt(await git(repoPath, 'rev-list', '--count', 'main'), 10);
    assert.equal(
      commitsAfter,
      commitsBefore + 1,
      'squash must produce exactly one new commit'
    );
    assert.equal(await git(repoPath, 'rev-parse', 'main'), result.commitSha);

    // The working copy follows the merge when it is clean.
    assert.equal(await git(repoPath, 'rev-parse', 'HEAD'), result.commitSha);
    assert.ok(await fs.stat(path.join(repoPath, 'feature.txt')));
  });

  test('merge strategy creates a real merge commit', async () => {
    await resetFixture();
    await git(repoPath, 'checkout', '-b', 'feature');
    await writeFile(repoPath, 'merge.txt', 'merge content\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'add merge file');
    await git(repoPath, 'checkout', 'main');

    const result = await gitService.mergePullRequest(repoName, 'main', 'feature', 'merge');
    assert.equal(result.success, true);

    const parents = await git(repoPath, 'rev-list', '--parents', '-n', '1', 'main');
    assert.equal(parents.split(' ').length, 3, 'merge commit must have two parents');
  });

  test('rebase strategy rewrites the source commits and fast-forwards the target', async () => {
    await resetFixture();

    // feature branches off the base and adds a commit …
    await git(repoPath, 'checkout', '-b', 'feature');
    await writeFile(repoPath, 'rebase.txt', 'rebase content\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'add rebase file');
    const originalFeatureSha = await git(repoPath, 'rev-parse', 'feature');

    // … while main moves on with an unrelated commit.
    await git(repoPath, 'checkout', 'main');
    await writeFile(repoPath, 'main-only.txt', 'main content\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'main moves on');

    const result = await gitService.mergePullRequest(repoName, 'main', 'feature', 'rebase');
    assert.equal(result.success, true);
    assert.equal(result.strategy, 'rebase');

    // The rebased commit is now the tip of main …
    assert.equal(await git(repoPath, 'rev-parse', 'main'), result.commitSha);
    // … the history was rewritten (new sha) …
    assert.notEqual(result.commitSha, originalFeatureSha);
    // … and the original source branch is left untouched.
    assert.equal(await git(repoPath, 'rev-parse', 'feature'), originalFeatureSha);
  });

  test('conflicting merge fails and leaves the target branch untouched', async () => {
    await resetFixture();

    // Both branches change the same line away from the common base.
    await git(repoPath, 'checkout', '-b', 'conflict');
    await writeFile(repoPath, 'README.md', 'conflict change\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'conflicting change');
    await git(repoPath, 'checkout', 'main');
    await writeFile(repoPath, 'README.md', 'main change\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'main change');

    const before = await git(repoPath, 'rev-parse', 'main');

    await assert.rejects(
      () => gitService.mergePullRequest(repoName, 'main', 'conflict', 'squash'),
      /Merge failed/
    );

    assert.equal(await git(repoPath, 'rev-parse', 'main'), before, 'main must not move');
    assert.equal((await git(repoPath, 'status', '--porcelain')).length, 0, 'worktree stays clean');
  });

  test('empty squash is rejected instead of creating an empty commit', async () => {
    await resetFixture();
    await git(repoPath, 'checkout', '-b', 'empty-feature');
    await git(repoPath, 'checkout', 'main');

    await assert.rejects(
      () => gitService.mergePullRequest(repoName, 'main', 'empty-feature', 'squash'),
      /Nothing to merge/
    );
  });

  test('mergeability check reports conflicting files', async () => {
    await resetFixture();

    await git(repoPath, 'checkout', '-b', 'conflict');
    await writeFile(repoPath, 'README.md', 'conflict change\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'conflicting change');
    await git(repoPath, 'checkout', 'main');
    await writeFile(repoPath, 'README.md', 'main change\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'main change');

    const result = await gitService.checkMergeConflict(repoName, 'main', 'conflict');
    assert.equal(result.canMerge, false);
    assert.ok(
      result.conflictedFiles.includes('README.md'),
      `expected README.md in ${JSON.stringify(result.conflictedFiles)}`
    );
  });

  test('mergeability check reports a clean merge', async () => {
    await resetFixture();
    await git(repoPath, 'checkout', '-b', 'feature');
    await writeFile(repoPath, 'clean.txt', 'clean\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'clean change');
    await git(repoPath, 'checkout', 'main');

    const result = await gitService.checkMergeConflict(repoName, 'main', 'feature');
    assert.equal(result.canMerge, true);
    assert.deepEqual(result.conflictedFiles, []);
  });
});

describe('GitService: branch safety', () => {
  let testRoot: string;
  let repoPath: string;
  const repoName = 'branch-fixture';
  let gitService: GitService;

  before(async () => {
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sourcehub-branch-'));
    repoPath = path.join(testRoot, repoName);
    await fs.mkdir(repoPath, { recursive: true });
    await git(repoPath, 'init', '-b', 'main');
    await writeFile(repoPath, 'README.md', 'base\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'Initial commit');
    gitService = new GitService(testRoot);
  });

  after(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  test('branch names that look like git options are rejected', async () => {
    // `git branch -D main` would have deleted the main branch.
    await assert.rejects(
      () => gitService.createBranch(repoName, '-D', 'main'),
      /Invalid branch name/
    );
    await assert.rejects(
      () => gitService.createBranch(repoName, 'feature', '--force'),
      /Invalid base branch name/
    );

    // main must still exist
    const branches = await gitService.listBranches(repoName);
    assert.ok(branches.includes('main'));
    assert.ok(!branches.includes('-D'));
  });

  test('protected branches cannot be deleted', async () => {
    await assert.rejects(
      () => gitService.deleteBranch(repoName, 'main'),
      /protected branch/
    );
  });

  test('regular branches can be created and deleted', async () => {
    await gitService.createBranch(repoName, 'temp-branch');
    let branches = await gitService.listBranches(repoName);
    assert.ok(branches.includes('temp-branch'));

    await gitService.deleteBranch(repoName, 'temp-branch');
    branches = await gitService.listBranches(repoName);
    assert.ok(!branches.includes('temp-branch'));
  });
});

describe('GitService: working copy path containment', () => {
  let testRoot: string;
  let repoPath: string;
  const repoName = 'path-fixture';
  let gitService: GitService;

  before(async () => {
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sourcehub-path-'));
    repoPath = path.join(testRoot, repoName);
    await fs.mkdir(repoPath, { recursive: true });
    await git(repoPath, 'init', '-b', 'main');
    await writeFile(repoPath, 'README.md', 'base\n');
    await git(repoPath, 'add', '.');
    await git(repoPath, 'commit', '-m', 'Initial commit');
    gitService = new GitService(testRoot);
  });

  after(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  test('a diff request for a file outside the repository returns nothing', async () => {
    const secret = path.join(testRoot, 'secret.txt');
    await fs.writeFile(secret, 'TOP SECRET\n', 'utf8');

    const diff = await gitService.getWorkingDiff(repoName, '../secret.txt');
    assert.equal(diff, null, 'traversal must not return file contents');

    const absolute = await gitService.getWorkingDiff(repoName, secret);
    assert.equal(absolute, null, 'absolute paths outside the repo must be rejected');
  });

  test('diffs for files inside the repository still work', async () => {
    await writeFile(repoPath, 'untracked.txt', 'hello\n');
    const diff = await gitService.getWorkingDiff(repoName, 'untracked.txt');
    assert.ok(diff);
    assert.equal(diff!.status, 'added');
    assert.ok(diff!.lines.some(l => l.content === 'hello'));
  });
});
