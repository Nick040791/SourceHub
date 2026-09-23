import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, maskSecret, getMasterKey } from '../server/crypto';

describe('Crypto: AES-256-GCM Secrets Encryption', () => {
  test('master key is 32 bytes (256 bits)', () => {
    const key = getMasterKey();
    assert.equal(key.length, 32);
  });

  test('encrypts and decrypts string successfully', () => {
    const secret = 'super-secret-api-token-12345!@#$%^&*()';
    const encrypted = encryptSecret(secret);

    assert.ok(encrypted.includes(':'), 'Encrypted output should contain iv:tag:ciphertext');
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3);
    assert.equal(parts[0].length, 24, 'IV should be 12 bytes (24 hex characters)');
    assert.equal(parts[1].length, 32, 'Tag should be 16 bytes (32 hex characters)');

    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, secret);
  });

  test('different encryptions of same secret produce unique IVs and ciphertexts', () => {
    const secret = 'identical-secret';
    const enc1 = encryptSecret(secret);
    const enc2 = encryptSecret(secret);

    assert.notEqual(enc1, enc2);
    assert.equal(decryptSecret(enc1), secret);
    assert.equal(decryptSecret(enc2), secret);
  });

  test('detects ciphertext tampering and fails authentication', () => {
    const secret = 'sensitive-data';
    const encrypted = encryptSecret(secret);
    const parts = encrypted.split(':');

    // Tamper with ciphertext by flipping last hex char
    const lastChar = parts[2].slice(-1);
    const flippedChar = lastChar === 'a' ? 'b' : 'a';
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -1)}${flippedChar}`;

    assert.throws(() => decryptSecret(tampered), /Unsupported state or unable to authenticate data/);
  });

  test('fails on invalid format', () => {
    assert.throws(() => decryptSecret('plain-text'), /Invalid encrypted payload format/);
    assert.throws(() => decryptSecret('a:b'), /Invalid encrypted payload format/);
  });

  test('masks secrets appropriately for UI presentation', () => {
    assert.equal(maskSecret(''), '••••••••');
    assert.equal(maskSecret('abc'), '••••••••');
    assert.equal(maskSecret('abcdef'), 'ab••ef');
    const longSecret = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
    const masked = maskSecret(longSecret);
    assert.ok(masked.startsWith('gh'));
    assert.ok(masked.endsWith('56'));
    assert.ok(masked.includes('•'));
  });
});
