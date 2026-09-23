import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GitService } from '../server/gitService';
import path from 'node:path';
import os from 'node:os';

describe('Security: Safe Path Resolution', () => {
  const testRoot = path.join(os.tmpdir(), 'sourcehub-test-repos');
  const gitService = new GitService(testRoot);

  test('resolves valid repo names inside rootDir', () => {
    const repoPath = gitService.getRepoPath('my-cool-project');
    assert.equal(repoPath, path.join(testRoot, 'my-cool-project'));
  });

  test('strips .git suffix cleanly', () => {
    const repoPath = gitService.getRepoPath('my-cool-project.git');
    assert.equal(repoPath, path.join(testRoot, 'my-cool-project'));
  });

  test('blocks path traversal attempts with ../', () => {
    assert.throws(
      () => gitService.getRepoPath('../../etc/passwd'),
      /path traversal characters detected/
    );
  });

  test('blocks path traversal attempts with backslashes', () => {
    assert.throws(
      () => gitService.getRepoPath('..\\..\\windows\\system32'),
      /path traversal characters detected/
    );
  });

  test('blocks embedded directory separators', () => {
    assert.throws(
      () => gitService.getRepoPath('sub/directory'),
      /path traversal characters detected/
    );
  });

  test('rejects empty or non-string names', () => {
    assert.throws(() => gitService.getRepoPath(''), /Repository name is required/);
    assert.throws(() => gitService.getRepoPath(null as any), /Repository name is required/);
  });
});
