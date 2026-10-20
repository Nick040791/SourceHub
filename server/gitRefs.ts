/**
 * Git ref-name validation and argument-injection guards.
 *
 * Every user-supplied string that reaches a `git` invocation as a *positional*
 * argument must pass through this module first. Git parses a leading `-` as an
 * option, so an unvalidated branch name such as `-D` turns
 * `git branch <name> <base>` into `git branch -D <base>` — silently deleting
 * a branch. Validation is cheap; a missing guard is a data-loss bug.
 *
 * Rules mirror `git check-ref-format --branch` with the additional
 * "must not look like an option" rule that protects positional arguments.
 */

const MAX_REF_LENGTH = 255;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const FORBIDDEN_CHARS = /[\s~^:?*[\\]/;
const SHA_PATTERN = /^[0-9a-f]{4,64}$/i;

/**
 * True when `name` is a safe branch/tag ref name.
 * Rejects option-like names, traversal sequences and git-invalid characters.
 */
export function isValidRefname(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > MAX_REF_LENGTH) return false;
  if (name.startsWith('-')) return false;
  if (name.startsWith('/') || name.endsWith('/')) return false;
  if (name.includes('//')) return false;
  if (name.includes('..')) return false;
  if (name.includes('@{')) return false;
  if (name === '@') return false;
  if (name.endsWith('.')) return false;
  if (CONTROL_CHARS.test(name)) return false;
  if (FORBIDDEN_CHARS.test(name)) return false;

  for (const component of name.split('/')) {
    if (component.length === 0) return false;
    if (component.startsWith('.')) return false;
  }
  return true;
}

/** Throw a descriptive error unless `name` is a valid ref name. */
export function assertValidRefname(name: unknown, label = 'ref name'): string {
  if (!isValidRefname(name)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(String(name))}`);
  }
  return name as string;
}

/** True when `sha` looks like a hexadecimal object id (full or abbreviated). */
export function isValidSha(sha: unknown): sha is string {
  return typeof sha === 'string' && SHA_PATTERN.test(sha);
}

/** Throw unless `sha` looks like a hexadecimal object id. */
export function assertValidSha(sha: unknown, label = 'commit sha'): string {
  if (!isValidSha(sha)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(String(sha))}`);
  }
  return (sha as string).toLowerCase();
}

/**
 * Guard a value that will be handed to git as a positional argument.
 * Option-like values are rejected outright rather than escaped, because the
 * correct fix for "my branch is called -x" is to reject the name, not to let
 * git interpret it.
 */
export function assertSafePositional(value: string, label = 'argument'): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string`);
  }
  if (value.startsWith('-')) {
    throw new Error(`Invalid ${label}: option-like values are not allowed`);
  }
  return value;
}

/**
 * Validate a list of positional git arguments in one go.
 * Used by the git wrappers so every call site is covered by one rule set.
 */
export function assertSafePositionals(values: string[], label = 'argument'): string[] {
  for (const value of values) {
    assertSafePositional(value, label);
  }
  return values;
}
