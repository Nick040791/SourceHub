import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidRefname,
  assertValidRefname,
  isValidSha,
  assertValidSha,
  assertSafePositional,
} from '../server/gitRefs';
import { resolveWithin, normalizeRepoRelative, isWithin } from '../server/pathSafety';
import path from 'node:path';

describe('GitRefs: ref name validation', () => {
  test('accepts ordinary branch names', () => {
    for (const name of ['main', 'feature/login', 'release-1.2', 'agent/run-abc-task', 'HEAD']) {
      assert.equal(isValidRefname(name), true, `${name} should be valid`);
    }
  });

  test('rejects option-like names (argument injection)', () => {
    // `git branch -D main` would delete the main branch.
    for (const name of ['-D', '-f', '--force', '--upload-pack=evil']) {
      assert.equal(isValidRefname(name), false, `${name} must be rejected`);
      assert.throws(() => assertValidRefname(name, 'branch name'), /Invalid branch name/);
    }
  });

  test('rejects traversal and git-invalid characters', () => {
    for (const name of [
      '../escape',
      'a..b',
      'a b',
      'a~1',
      'a^',
      'a:b',
      'a?b',
      'a*b',
      'a[b',
      'a\\b',
      'a@{b',
      '/leading',
      'trailing/',
      'double//slash',
      '.hidden',
      'ends.',
      '@',
      '',
    ]) {
      assert.equal(isValidRefname(name), false, `${JSON.stringify(name)} must be rejected`);
    }
  });

  test('rejects control characters and over-long names', () => {
    assert.equal(isValidRefname('bad\u0000name'), false);
    assert.equal(isValidRefname('bad\nname'), false);
    assert.equal(isValidRefname('a'.repeat(256)), false);
  });

  test('rejects non-string input', () => {
    assert.equal(isValidRefname(null), false);
    assert.equal(isValidRefname(undefined), false);
    assert.equal(isValidRefname(42), false);
    assert.equal(isValidRefname({}), false);
  });
});

describe('GitRefs: sha validation', () => {
  test('accepts full and abbreviated hex shas', () => {
    assert.equal(isValidSha('a'.repeat(40)), true);
    assert.equal(isValidSha('abc1234'), true);
  });

  test('rejects non-hex and option-like values', () => {
    assert.equal(isValidSha('zzzz'), false);
    assert.equal(isValidSha('--upload-pack=x'), false);
    assert.equal(isValidSha('abc;rm -rf /'), false);
    assert.throws(() => assertValidSha('not-a-sha'), /Invalid commit sha/);
  });
});

describe('GitRefs: positional argument guard', () => {
  test('rejects option-like positional values', () => {
    assert.throws(() => assertSafePositional('-D'), /option-like/);
    assert.throws(() => assertSafePositional(''), /non-empty/);
    assert.equal(assertSafePositional('main'), 'main');
  });
});

describe('PathSafety: containment', () => {
  const root = path.resolve('/tmp/sourcehub-root');

  test('keeps paths inside the root', () => {
    assert.equal(resolveWithin(root, 'src/app.ts'), path.join(root, 'src/app.ts'));
    assert.equal(resolveWithin(root, './src/../src/app.ts'), path.join(root, 'src/app.ts'));
  });

  test('rejects traversal outside the root', () => {
    assert.throws(() => resolveWithin(root, '../../etc/passwd'), /outside the repository root/);
    assert.throws(() => resolveWithin(root, '/etc/passwd'), /outside the repository root/);
    assert.throws(() => resolveWithin(root, 'a/../../b'), /outside the repository root/);
    assert.equal(isWithin(root, '../escape'), false);
  });

  test('rejects null bytes', () => {
    assert.throws(() => resolveWithin(root, 'a\u0000b'), /null byte/);
  });

  test('normalizeRepoRelative strips leading traversal', () => {
    assert.equal(normalizeRepoRelative('../../etc/passwd'), 'etc/passwd');
    assert.equal(normalizeRepoRelative('src/app.ts'), 'src/app.ts');
    assert.throws(() => normalizeRepoRelative('\u0000'), /null byte/);
  });
});
