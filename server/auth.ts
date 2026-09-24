/**
 * SourceHub authentication helpers.
 *
 * Acceptance order (documented in README):
 *   1. Valid SOURCEHUB_TOKEN (operator shared secret), OR
 *   2. Valid Personal Access Token (sh_pat_… hashed in DB), OR
 *   3. Unauthenticated only when bind is loopback AND SOURCEHUB_TOKEN is unset.
 *
 * When SOURCEHUB_TOKEN is set, it is always required (loopback or not).
 * When binding non-loopback without SOURCEHUB_TOKEN, refuse to start.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { db } from './db';

export const PAT_PREFIX = 'sh_pat_';
export const TOKEN_HEADER = 'x-sourcehub-token';
export const AUTH_STORAGE_KEY = 'sourcehub_api_token';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function isLoopbackHost(host: string | undefined | null): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  // Strip IPv6 brackets; ignore zone id / port-like suffixes callers may pass
  const bare = h.replace(/^\[/, '').replace(/\]$/, '').split('%')[0];
  if (LOOPBACK_HOSTS.has(bare)) return true;
  if (bare === '0:0:0:0:0:0:0:1') return true;
  return false;
}

export function getConfiguredSharedSecret(): string | undefined {
  const v = process.env.SOURCEHUB_TOKEN;
  if (v == null) return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Refuse to start when binding to a non-loopback address without SOURCEHUB_TOKEN.
 * Call from production server and Vite plugin configureServer.
 */
export function assertSafeBindOrThrow(host: string): void {
  if (isLoopbackHost(host)) return;
  if (getConfiguredSharedSecret()) return;
  throw new Error(
    `Refusing to bind to non-loopback address "${host}" without SOURCEHUB_TOKEN.\n` +
      `Set SOURCEHUB_TOKEN to a strong shared secret, or bind to 127.0.0.1 / ::1 for local-only use.\n` +
      `Example: SOURCEHUB_TOKEN=$(openssl rand -hex 32) HOST=0.0.0.0 npm run serve`
  );
}

/** SHA-256 hex digest of a token (used for PAT storage). */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function verifyTokenHash(token: string, hash: string): boolean {
  if (!token || !hash) return false;
  const computed = hashToken(token);
  try {
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Constant-time string compare for shared secrets. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Generate a new PAT. Full token returned once; store only the hash. */
export function generatePat(): { token: string; prefix: string; last4: string; hash: string } {
  const random = crypto.randomBytes(24).toString('base64url');
  const token = `${PAT_PREFIX}${random}`;
  const prefix = `${PAT_PREFIX}${random.slice(0, 6)}`;
  const last4 = token.slice(-4);
  return { token, prefix, last4, hash: hashToken(token) };
}

export function formatTokenDisplay(prefix: string, last4?: string | null): string {
  if (last4) return `${prefix}…${last4}`;
  return prefix.includes('…') ? prefix : `${prefix}…`;
}

export type PresentedCredential =
  | { kind: 'bearer'; value: string }
  | { kind: 'header'; value: string }
  | { kind: 'none' };

export function extractPresentedCredential(req: IncomingMessage): PresentedCredential {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1].trim()) {
      return { kind: 'bearer', value: m[1].trim() };
    }
  }
  const headerVal = req.headers[TOKEN_HEADER];
  const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (typeof raw === 'string' && raw.trim()) {
    return { kind: 'header', value: raw.trim() };
  }
  return { kind: 'none' };
}

export type AuthResult =
  | { ok: true; method: 'shared_secret' | 'pat' | 'loopback_open' }
  | { ok: false; status: number; error: string };

/**
 * Authenticate an API / Smart HTTP request.
 * `bindHost` is the server listen address (HOST env), not the client IP.
 */
export function authenticateRequest(req: IncomingMessage, bindHost?: string): AuthResult {
  const shared = getConfiguredSharedSecret();
  const presented = extractPresentedCredential(req);
  const host = bindHost ?? process.env.HOST ?? '127.0.0.1';

  if (presented.kind !== 'none') {
    if (shared && timingSafeEqualString(presented.value, shared)) {
      return { ok: true, method: 'shared_secret' };
    }
    if (presented.value.startsWith(PAT_PREFIX)) {
      const pat = findValidPat(presented.value);
      if (pat) {
        touchPatLastUsed(pat.id);
        return { ok: true, method: 'pat' };
      }
    }
    // Wrong credential presented — always reject (do not fall through to open loopback)
    return { ok: false, status: 401, error: 'Invalid or revoked credentials' };
  }

  // No credential presented
  if (shared) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required. Provide Authorization: Bearer <token> or X-SourceHub-Token.',
    };
  }

  // SOURCEHUB_TOKEN unset: allow only when bound to loopback
  if (isLoopbackHost(host)) {
    return { ok: true, method: 'loopback_open' };
  }

  return {
    ok: false,
    status: 401,
    error: 'Authentication required for non-loopback bind. Set SOURCEHUB_TOKEN.',
  };
}

function findValidPat(token: string): { id: string } | null {
  try {
    const rows = db
      .prepare(
        `SELECT id, token_hash, expires_at FROM tokens WHERE token_hash IS NOT NULL AND token_hash != ''`
      )
      .all() as { id: string; token_hash: string; expires_at: string }[];

    for (const row of rows) {
      if (!verifyTokenHash(token, row.token_hash)) continue;
      if (row.expires_at && isExpired(row.expires_at)) continue;
      return { id: row.id };
    }
  } catch (e) {
    console.warn('[Auth] PAT lookup failed:', e);
  }
  return null;
}

function isExpired(expiresAt: string): boolean {
  // Support ISO timestamps; legacy relative strings are treated as not expired.
  if (!expiresAt || !/^\d{4}-\d{2}-\d{2}/.test(expiresAt)) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function touchPatLastUsed(id: string): void {
  try {
    db.prepare(`UPDATE tokens SET last_used = ? WHERE id = ?`).run(new Date().toISOString(), id);
  } catch {
    /* ignore */
  }
}

/**
 * Enforce auth for /api/* and /git/* routes.
 * Returns true if the response was already sent (caller should stop).
 */
export function enforceAuth(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  bindHost?: string
): boolean {
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/git/')) {
    return false;
  }
  const result = authenticateRequest(req, bindHost);
  if (result.ok) return false;

  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('WWW-Authenticate', 'Bearer realm="SourceHub"');
  res.end(JSON.stringify({ error: result.error }));
  return true;
}

/** Build sanitized env for workflow step execution (no full process.env dump). */
export function buildSanitizedWorkflowEnv(
  secrets: Record<string, string>,
  stepEnv: Record<string, string> | undefined,
  extras: Record<string, string>
): NodeJS.ProcessEnv {
  const pathEnv = process.env.PATH || '/usr/local/bin:/usr/bin:/bin';
  const home = process.env.HOME || '/tmp';
  const env: NodeJS.ProcessEnv = {
    PATH: pathEnv,
    HOME: home,
    LANG: process.env.LANG || 'C.UTF-8',
    TERM: 'dumb',
    CI: 'true',
    SOURCEHUB: 'true',
    ...extras,
  };
  for (const [k, v] of Object.entries(secrets)) {
    if (k && typeof v === 'string') env[k] = v;
  }
  if (stepEnv) {
    for (const [k, v] of Object.entries(stepEnv)) {
      if (k && typeof v === 'string') env[k] = v;
    }
  }
  // Never inherit operator shared secret or master key into CI jobs
  delete env.SOURCEHUB_TOKEN;
  delete env.SOURCEHUB_MASTER_KEY;
  return env;
}

/**
 * Reject obviously dangerous run scripts. Pragmatic guard, not a full sandbox.
 * Workflows are trusted operator content — document that in README.
 */
export function isDangerousRunScript(command: string): boolean {
  const c = command.trim();
  if (!c) return true;
  if (c.includes('\0')) return true;
  if (/(?:^|[\s;|&])(?:cat|tee|cp|mv|dd|chmod|chown)\s+[^\n]*\/(?:etc|root|proc|sys)\//i.test(c)) {
    return true;
  }
  return false;
}

export function resolveSafeExecutionDir(repoPath: string, candidate: string): string {
  const resolvedRepo = path.resolve(repoPath);
  const resolved = path.resolve(candidate);
  const tmpPrefix = path.resolve('/tmp');
  const isCiWorktree =
    resolved.startsWith(tmpPrefix + path.sep) && path.basename(resolved).startsWith('sh-ci-');
  if (resolved !== resolvedRepo && !resolved.startsWith(resolvedRepo + path.sep) && !isCiWorktree) {
    throw new Error(`Workflow execution path escapes repository root: ${candidate}`);
  }
  return resolved;
}
