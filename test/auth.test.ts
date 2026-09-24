import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import {
  hashToken,
  verifyTokenHash,
  timingSafeEqualString,
  generatePat,
  isLoopbackHost,
  assertSafeBindOrThrow,
  authenticateRequest,
  extractPresentedCredential,
  isDangerousRunScript,
  buildSanitizedWorkflowEnv,
  formatTokenDisplay,
  PAT_PREFIX,
} from '../server/auth';
import { db } from '../server/db';

function mockReq(headers: Record<string, string | undefined> = {}): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe('Auth: token hashing', () => {
  test('hashToken is deterministic sha256 hex', () => {
    const a = hashToken('sh_pat_example');
    const b = hashToken('sh_pat_example');
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
  });

  test('verifyTokenHash accepts matching token', () => {
    const token = 'sh_pat_abc123xyz';
    const hash = hashToken(token);
    assert.equal(verifyTokenHash(token, hash), true);
    assert.equal(verifyTokenHash('wrong', hash), false);
  });

  test('timingSafeEqualString compares shared secrets', () => {
    assert.equal(timingSafeEqualString('secret', 'secret'), true);
    assert.equal(timingSafeEqualString('secret', 'Secret'), false);
    assert.equal(timingSafeEqualString('a', 'ab'), false);
  });

  test('generatePat returns hashable token with prefix', () => {
    const { token, prefix, last4, hash } = generatePat();
    assert.ok(token.startsWith(PAT_PREFIX));
    assert.ok(prefix.startsWith(PAT_PREFIX));
    assert.equal(last4.length, 4);
    assert.equal(verifyTokenHash(token, hash), true);
    assert.equal(formatTokenDisplay(prefix, last4), `${prefix}…${last4}`);
  });
});

describe('Auth: loopback / bind guards', () => {
  test('isLoopbackHost recognizes localhost variants', () => {
    assert.equal(isLoopbackHost('127.0.0.1'), true);
    assert.equal(isLoopbackHost('::1'), true);
    assert.equal(isLoopbackHost('localhost'), true);
    assert.equal(isLoopbackHost('0.0.0.0'), false);
    assert.equal(isLoopbackHost('192.168.1.10'), false);
  });

  test('assertSafeBindOrThrow refuses non-loopback without token', () => {
    const prev = process.env.SOURCEHUB_TOKEN;
    delete process.env.SOURCEHUB_TOKEN;
    assert.throws(() => assertSafeBindOrThrow('0.0.0.0'), /SOURCEHUB_TOKEN/);
    assert.doesNotThrow(() => assertSafeBindOrThrow('127.0.0.1'));
    process.env.SOURCEHUB_TOKEN = 'test-shared-secret';
    assert.doesNotThrow(() => assertSafeBindOrThrow('0.0.0.0'));
    if (prev === undefined) delete process.env.SOURCEHUB_TOKEN;
    else process.env.SOURCEHUB_TOKEN = prev;
  });
});

describe('Auth: middleware allow/deny', () => {
  const prevToken = process.env.SOURCEHUB_TOKEN;
  const prevHost = process.env.HOST;
  let insertedId: string | null = null;
  let patPlain: string | null = null;

  before(() => {
    delete process.env.SOURCEHUB_TOKEN;
    process.env.HOST = '127.0.0.1';
    const { token, prefix, last4, hash } = generatePat();
    patPlain = token;
    insertedId = `tok-test-${Date.now()}`;
    db.prepare(`
      INSERT INTO tokens (id, name, token_prefix, token_hash, token_last4, scopes, created_at, expires_at, last_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertedId,
      'test-pat',
      prefix,
      hash,
      last4,
      JSON.stringify(['repo:read']),
      new Date().toISOString(),
      new Date(Date.now() + 86400000).toISOString(),
      null
    );
  });

  after(() => {
    if (insertedId) {
      try { db.prepare('DELETE FROM tokens WHERE id = ?').run(insertedId); } catch {}
    }
    if (prevToken === undefined) delete process.env.SOURCEHUB_TOKEN;
    else process.env.SOURCEHUB_TOKEN = prevToken;
    if (prevHost === undefined) delete process.env.HOST;
    else process.env.HOST = prevHost;
  });

  test('extractPresentedCredential reads Bearer and X-SourceHub-Token', () => {
    assert.equal(extractPresentedCredential(mockReq({})).kind, 'none');
    const b = extractPresentedCredential(mockReq({ authorization: 'Bearer abc' }));
    assert.equal(b.kind, 'bearer');
    assert.equal((b as any).value, 'abc');
    const h = extractPresentedCredential(mockReq({ 'x-sourcehub-token': 'xyz' }));
    assert.equal(h.kind, 'header');
    assert.equal((h as any).value, 'xyz');
  });

  test('loopback + no SOURCEHUB_TOKEN allows unauthenticated', () => {
    delete process.env.SOURCEHUB_TOKEN;
    const r = authenticateRequest(mockReq({}), '127.0.0.1');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.method, 'loopback_open');
  });

  test('non-loopback + no SOURCEHUB_TOKEN denies without credential', () => {
    delete process.env.SOURCEHUB_TOKEN;
    const r = authenticateRequest(mockReq({}), '0.0.0.0');
    assert.equal(r.ok, false);
  });

  test('SOURCEHUB_TOKEN required when set (even on loopback)', () => {
    process.env.SOURCEHUB_TOKEN = 'op-secret-999';
    const denied = authenticateRequest(mockReq({}), '127.0.0.1');
    assert.equal(denied.ok, false);
    const allowed = authenticateRequest(
      mockReq({ authorization: 'Bearer op-secret-999' }),
      '127.0.0.1'
    );
    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.equal(allowed.method, 'shared_secret');
    const viaHeader = authenticateRequest(
      mockReq({ 'x-sourcehub-token': 'op-secret-999' }),
      '0.0.0.0'
    );
    assert.equal(viaHeader.ok, true);
  });

  test('valid PAT is accepted', () => {
    delete process.env.SOURCEHUB_TOKEN;
    assert.ok(patPlain);
    const r = authenticateRequest(
      mockReq({ authorization: `Bearer ${patPlain}` }),
      '0.0.0.0'
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.method, 'pat');
  });

  test('invalid credential is rejected (no loopback fallback)', () => {
    delete process.env.SOURCEHUB_TOKEN;
    const r = authenticateRequest(
      mockReq({ authorization: 'Bearer sh_pat_notreal' }),
      '127.0.0.1'
    );
    assert.equal(r.ok, false);
  });
});

describe('Auth: workflow env sandbox helpers', () => {
  test('buildSanitizedWorkflowEnv omits process.env dump and secrets keys', () => {
    process.env.SOURCEHUB_TOKEN = 'should-not-leak';
    process.env.SOURCEHUB_MASTER_KEY = 'master-should-not-leak';
    const env = buildSanitizedWorkflowEnv(
      { API_TOKEN: 'secret123' },
      { NODE_ENV: 'test' },
      { SOURCEHUB_BRANCH: 'main' }
    );
    assert.equal(env.API_TOKEN, 'secret123');
    assert.equal(env.NODE_ENV, 'test');
    assert.equal(env.SOURCEHUB_BRANCH, 'main');
    assert.equal(env.CI, 'true');
    assert.ok(env.PATH);
    assert.equal(env.SOURCEHUB_TOKEN, undefined);
    assert.equal(env.SOURCEHUB_MASTER_KEY, undefined);
    delete process.env.SOURCEHUB_TOKEN;
    delete process.env.SOURCEHUB_MASTER_KEY;
  });

  test('isDangerousRunScript flags absolute /etc writes', () => {
    assert.equal(isDangerousRunScript('npm test'), false);
    assert.equal(isDangerousRunScript('cat /etc/passwd > /tmp/x'), true);
    assert.equal(isDangerousRunScript(''), true);
  });
});

describe('Auth: production server bind guard contract', () => {
  test('assertSafeBindOrThrow matches production HOST defaults (README)', () => {
    const prev = process.env.SOURCEHUB_TOKEN;
    delete process.env.SOURCEHUB_TOKEN;
    // Production default HOST is 127.0.0.1 — must allow without token
    assert.doesNotThrow(() => assertSafeBindOrThrow('127.0.0.1'));
    assert.doesNotThrow(() => assertSafeBindOrThrow('localhost'));
    assert.doesNotThrow(() => assertSafeBindOrThrow('::1'));
    // Non-loopback (LAN / all-interfaces) must refuse without SOURCEHUB_TOKEN
    assert.throws(() => assertSafeBindOrThrow('0.0.0.0'), /Refusing to bind|SOURCEHUB_TOKEN/);
    assert.throws(() => assertSafeBindOrThrow('192.168.1.10'), /SOURCEHUB_TOKEN/);
    // With token, non-loopback is allowed
    process.env.SOURCEHUB_TOKEN = 'prod-path-secret';
    assert.doesNotThrow(() => assertSafeBindOrThrow('0.0.0.0'));
    assert.doesNotThrow(() => assertSafeBindOrThrow('192.168.1.10'));
    if (prev === undefined) delete process.env.SOURCEHUB_TOKEN;
    else process.env.SOURCEHUB_TOKEN = prev;
  });

  test('server/index.ts calls assertSafeBindOrThrow before listen', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const src = await fs.readFile(path.join(root, 'server/index.ts'), 'utf8');
    const guardIdx = src.indexOf('assertSafeBindOrThrow(HOST)');
    const listenIdx = src.indexOf('server.listen(');
    assert.ok(guardIdx >= 0, 'production server must call assertSafeBindOrThrow(HOST)');
    assert.ok(listenIdx >= 0, 'production server must call server.listen');
    assert.ok(guardIdx < listenIdx, 'assertSafeBindOrThrow must run before server.listen');
  });
});
