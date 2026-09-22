import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

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
try {
  db.exec('ALTER TABLE secrets ADD COLUMN encrypted_value TEXT;');
} catch (_) {}

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
          INSERT INTO ssh_keys (id, title, key_type, public_key, fingerprint, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `key-${Date.now()}`,
          `Local Key (${title})`,
          keyType,
          content,
          'SHA256:auto-detected-local-key',
          'user',
          'auto-detected'
        );
        break;
      }
    }
  }
} catch (e) {
  console.warn('Could not auto-detect SSH key:', e);
}

