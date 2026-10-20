/**
 * Operator audit log.
 *
 * Records the actions that change a repository or its metadata so an
 * operator can reconstruct what happened, and who did it. Writes are
 * best-effort: a failing audit write must never break the operation it
 * describes.
 */
import crypto from 'node:crypto';
import { db } from './db';

export interface AuditEntry {
  id: string;
  repoName: string | null;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdMs: number;
}

/** Append an entry to the audit log. */
export function recordAudit(
  action: string,
  options: {
    repoName?: string | null;
    actor?: string;
    target?: string | null;
    detail?: string | null;
  } = {}
): void {
  try {
    db.prepare(`
      INSERT INTO audit_log (id, repo_name, actor, action, target, detail, created_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `audit-${crypto.randomUUID()}`,
      options.repoName ?? null,
      options.actor || 'Forge Operator',
      action,
      options.target ?? null,
      options.detail ?? null,
      Date.now()
    );
  } catch (e) {
    console.warn('[Audit] could not record entry:', (e as Error).message);
  }
}

/** Recent audit entries, optionally scoped to a repository. */
export function listAudit(repoName?: string | null, limit = 100): AuditEntry[] {
  try {
    const rows = repoName
      ? (db
          .prepare(
            'SELECT * FROM audit_log WHERE repo_name = ? ORDER BY created_ms DESC LIMIT ?'
          )
          .all(repoName, limit) as any[])
      : (db
          .prepare('SELECT * FROM audit_log ORDER BY created_ms DESC LIMIT ?')
          .all(limit) as any[]);

    return rows.map(r => ({
      id: r.id,
      repoName: r.repo_name,
      actor: r.actor,
      action: r.action,
      target: r.target,
      detail: r.detail,
      createdMs: r.created_ms,
    }));
  } catch {
    return [];
  }
}
