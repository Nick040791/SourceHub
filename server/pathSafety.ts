/**
 * Path containment helpers shared by the git and workflow layers.
 *
 * SourceHub reads and writes files on behalf of API callers. Any path that
 * originates from a request must be proven to stay inside the repository
 * before it reaches `fs` or `git diff --no-index` (which happily reads
 * arbitrary files outside a repository).
 */
import path from 'node:path';

/**
 * Resolve `candidate` against `root` and guarantee the result stays inside
 * `root`. Absolute paths are resolved as-is and therefore rejected unless they
 * already live under `root`.
 */
export function resolveWithin(root: string, candidate: string, label = 'path'): string {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string`);
  }
  if (candidate.includes('\0')) {
    throw new Error(`Invalid ${label}: contains a null byte`);
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);

  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Invalid ${label}: resolves outside the repository root`);
  }
  return resolved;
}

/** True when `candidate` resolves inside `root`. */
export function isWithin(root: string, candidate: string): boolean {
  try {
    resolveWithin(root, candidate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a repository-relative path for git plumbing.
 * Strips leading `../` segments so a traversal attempt degrades to a
 * harmless relative path instead of escaping the tree.
 */
export function normalizeRepoRelative(filePath: string): string {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('Invalid file path: must be a non-empty string');
  }
  if (filePath.includes('\0')) {
    throw new Error('Invalid file path: contains a null byte');
  }
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized.startsWith('/') || normalized === '..') {
    throw new Error(`Invalid file path: ${JSON.stringify(filePath)}`);
  }
  return normalized;
}
