/**
 * Durable operator settings stored in the `system_settings` table.
 *
 * These knobs are read on hot paths (merge gating, branch protection), so
 * they are cached in memory and refreshed on write.
 */
import { db } from './db';

const cache = new Map<string, string>();

function readSetting(key: string): string | undefined {
  if (cache.has(key)) return cache.get(key);
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    const value = row?.value;
    if (value !== undefined) cache.set(key, value);
    return value;
  } catch {
    return undefined;
  }
}

export function getSetting(key: string, fallback?: string): string | undefined {
  const value = readSetting(key);
  return value === undefined ? fallback : value;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
  cache.set(key, value);
}

/** Branches that may not be deleted or force-updated. */
export function getProtectedBranches(): string[] {
  const raw = getSetting('protected_branches', 'main,master');
  return (raw || '')
    .split(',')
    .map(b => b.trim())
    .filter(Boolean);
}

export function isProtectedBranch(branch: string): boolean {
  return getProtectedBranches().includes(branch);
}

/**
 * Whether a pull request must have passing CI checks before it can merge.
 * Defaults to enabled — the README promises CI gating.
 */
export function mergeRequiresChecks(): boolean {
  return getSetting('merge_require_checks', 'true') !== 'false';
}
