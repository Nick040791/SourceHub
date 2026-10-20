import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { computeSshFingerprint } from './crypto';

const dataDir = process.env.SOURCEHUB_DATA_DIR || path.join(os.homedir(), '.sourcehub');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'sourcehub.db');
export const db = new DatabaseSync(dbPath);

// Initialize database schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS pull_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_name TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT DEFAULT 'open',
    author TEXT NOT NULL,
    is_agent INTEGER DEFAULT 0,
    agent_run_id TEXT,
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pr_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    is_agent INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (pr_id) REFERENCES pull_requests (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_name TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    status TEXT DEFAULT 'open',
    author TEXT NOT NULL,
    assigned_to_agent INTEGER DEFAULT 0,
    agent_run_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS issue_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issues (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS secrets (
    id TEXT PRIMARY KEY,
    repo_name TEXT,
    name TEXT NOT NULL,
    scope TEXT NOT NULL,
    encrypted_value TEXT,
    masked_value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used TEXT
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    token_hash TEXT,
    token_last4 TEXT,
    scopes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_used TEXT
  );

  CREATE TABLE IF NOT EXISTS ssh_keys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    key_type TEXT NOT NULL,
    public_key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    repo_name TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    workflow_path TEXT NOT NULL,
    event TEXT NOT NULL,
    status TEXT NOT NULL,
    branch TEXT NOT NULL,
    commit_sha TEXT NOT NULL,
    commit_message TEXT NOT NULL,
    author TEXT NOT NULL,
    duration TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workflow_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    duration TEXT NOT NULL,
    logs TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    repo_name TEXT NOT NULL,
    slug TEXT NOT NULL,
    prompt TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    mode TEXT NOT NULL,
    state TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operator TEXT NOT NULL,
    pr_id INTEGER,
    files_touched TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_timeline (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    metadata TEXT,
    created_order INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    repo_name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    secret TEXT,
    created_at TEXT NOT NULL
  );
`);

// Migrations / safe column additions
function addColumn(table: string, column: string, definition: string): void {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (e) {
    console.warn(`[db] could not add ${table}.${column}:`, (e as Error).message);
  }
}

addColumn('secrets', 'encrypted_value', 'TEXT');
addColumn('tokens', 'token_hash', 'TEXT');
addColumn('tokens', 'token_last4', 'TEXT');
// Clear legacy placeholder PATs that never stored a verifiable hash
try {
  db.exec(`DELETE FROM tokens WHERE token_hash IS NULL OR token_hash = ''`);
} catch (_) {}
addColumn('pull_requests', 'checks_status', "TEXT DEFAULT 'pending'");
addColumn('pull_requests', 'checks_summary', "TEXT DEFAULT 'Checks have not run yet'");
addColumn('pull_requests', 'workflow_run_id', 'TEXT');

// Real timestamps: the old columns stored the literal string "Just now",
// which can never be ordered or rendered as a date. `*_ms` columns hold
// epoch milliseconds and are the source of truth.
for (const table of [
  'pull_requests',
  'pr_comments',
  'issues',
  'issue_comments',
  'workflow_runs',
  'workflow_steps',
  'agent_runs',
  'agent_timeline',
  'secrets',
  'webhooks',
  'ssh_keys',
]) {
  addColumn(table, 'created_ms', 'INTEGER');
}
for (const table of ['pull_requests', 'workflow_runs', 'agent_runs']) {
  addColumn(table, 'updated_ms', 'INTEGER');
  addColumn(table, 'completed_ms', 'INTEGER');
}

// Per-repo PR numbers (#4): the global autoincrement id made the first PR of a
// fresh repo show as "PR #14". Add a repo-scoped `number` and backfill.
try {
  const prCols = db.prepare('PRAGMA table_info(pull_requests)').all() as { name: string }[];
  if (!prCols.some(c => c.name === 'number')) {
    db.exec('ALTER TABLE pull_requests ADD COLUMN number INTEGER;');
    const prRepos = db.prepare('SELECT DISTINCT repo_name FROM pull_requests').all() as { repo_name: string }[];
    const prRowsStmt = db.prepare('SELECT id FROM pull_requests WHERE repo_name = ? ORDER BY id ASC');
    const prRenumberStmt = db.prepare('UPDATE pull_requests SET number = ? WHERE id = ?');
    for (const prRepo of prRepos) {
      (prRowsStmt.all(prRepo.repo_name) as { id: number }[]).forEach((row, idx) => {
        prRenumberStmt.run(idx + 1, row.id);
      });
    }
    console.log('[db] pull_requests: backfilled per-repo PR numbers');
  }
} catch (e) {
  console.warn('[db] pull_requests number migration skipped:', (e as Error).message);
}

// Per-repo issue numbers (mirrors the PR numbering fix above).
try {
  const issueCols = db.prepare('PRAGMA table_info(issues)').all() as { name: string }[];
  if (!issueCols.some(c => c.name === 'number')) {
    db.exec('ALTER TABLE issues ADD COLUMN number INTEGER;');
    const issueRepos = db.prepare('SELECT DISTINCT repo_name FROM issues').all() as { repo_name: string }[];
    const issueRowsStmt = db.prepare('SELECT id FROM issues WHERE repo_name = ? ORDER BY id ASC');
    const issueRenumberStmt = db.prepare('UPDATE issues SET number = ? WHERE id = ?');
    for (const issueRepo of issueRepos) {
      (issueRowsStmt.all(issueRepo.repo_name) as { id: number }[]).forEach((row, idx) => {
        issueRenumberStmt.run(idx + 1, row.id);
      });
    }
    console.log('[db] issues: backfilled per-repo issue numbers');
  }
} catch (e) {
  console.warn('[db] issues number migration skipped:', (e as Error).message);
}

// Pull request snapshots: the diff of a PR used to be recomputed from git on
// every read, so deleting the source branch erased the PR's contents.
// The snapshot keeps merged/closed PRs readable forever.
addColumn('pull_requests', 'base_sha', 'TEXT');
addColumn('pull_requests', 'head_sha', 'TEXT');
addColumn('pull_requests', 'merge_base', 'TEXT');
addColumn('pull_requests', 'diff_snapshot', 'TEXT');
addColumn('pull_requests', 'commits_snapshot', 'TEXT');
addColumn('pull_requests', 'additions', 'INTEGER DEFAULT 0');
addColumn('pull_requests', 'deletions', 'INTEGER DEFAULT 0');
addColumn('pull_requests', 'merged_sha', 'TEXT');
addColumn('pull_requests', 'merge_strategy', 'TEXT');
addColumn('pull_requests', 'merged_ms', 'INTEGER');

// Workflow run lifecycle bookkeeping.
addColumn('workflow_runs', 'started_ms', 'INTEGER');
addColumn('workflow_runs', 'finished_ms', 'INTEGER');
addColumn('workflow_runs', 'error', 'TEXT');
addColumn('workflow_runs', 'canceled', 'INTEGER DEFAULT 0');

// Webhook delivery history.
db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    repo_name TEXT,
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER,
    status_text TEXT,
    error TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 0,
    created_ms INTEGER NOT NULL
  );
`);

/** Next repo-scoped PR number for inserts. Single-process SQLite => no race. */
export function nextPullRequestNumber(repoName: string): number {
  const row = db.prepare(
    'SELECT COALESCE(MAX(number), 0) + 1 AS n FROM pull_requests WHERE repo_name = ?'
  ).get(repoName) as { n: number };
  return row.n || 1;
}

/** Next repo-scoped issue number for inserts. */
export function nextIssueNumber(repoName: string): number {
  const row = db.prepare(
    'SELECT COALESCE(MAX(number), 0) + 1 AS n FROM issues WHERE repo_name = ?'
  ).get(repoName) as { n: number };
  return row.n || 1;
}

// Auto-seed initial SSH key if user has ~/.ssh/id_ed25519.pub or id_rsa.pub
try {
  const existingKeys = db.prepare('SELECT COUNT(*) as count FROM ssh_keys').get() as { count: number };
  if (existingKeys.count === 0) {
    const sshDir = path.join(os.homedir(), '.ssh');
    const keyFiles = ['id_ed25519.pub', 'id_rsa.pub'];
    for (const keyFile of keyFiles) {
      const p = path.join(sshDir, keyFile);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8').trim();
        const parts = content.split(' ');
        const keyType = parts[0] || 'ssh-ed25519';
        const title = parts[2] || `${os.userInfo().username}@${os.hostname()}`;
        db.prepare(`
          INSERT INTO ssh_keys (id, title, key_type, public_key, fingerprint, type, created_at, created_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `key-${crypto.randomUUID()}`,
          `Local Key (${title})`,
          keyType,
          content,
          computeSshFingerprint(content),
          'user',
          'auto-detected',
          Date.now()
        );
        break;
      }
    }
  }
} catch (e) {
  console.warn('Could not auto-detect SSH key:', e);
}

