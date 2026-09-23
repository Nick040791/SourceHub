import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const KEY_LENGTH = 32; // 256 bits

let cachedMasterKey: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  // 1. Check environment variable
  if (process.env.SOURCEHUB_MASTER_KEY) {
    const envKey = process.env.SOURCEHUB_MASTER_KEY.trim();
    if (envKey.length === 64) {
      cachedMasterKey = Buffer.from(envKey, 'hex');
      return cachedMasterKey;
    }
    // Hash key if not exactly 32-byte hex
    cachedMasterKey = crypto.createHash('sha256').update(envKey).digest();
    return cachedMasterKey;
  }

  // 2. Load or generate key file in SOURCEHUB_DATA_DIR
  const dataDir = process.env.SOURCEHUB_DATA_DIR || path.join(os.homedir(), '.sourcehub');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const keyPath = path.join(dataDir, 'master.key');
  if (fs.existsSync(keyPath)) {
    try {
      const raw = fs.readFileSync(keyPath, 'utf8').trim();
      if (raw.length === 64) {
        cachedMasterKey = Buffer.from(raw, 'hex');
        return cachedMasterKey;
      }
    } catch (e) {
      console.warn('[Crypto] Could not read master key file, regenerating:', e);
    }
  }

  // Generate a new 256-bit key
  const newKey = crypto.randomBytes(KEY_LENGTH);
  try {
    fs.writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 });
  } catch (e) {
    console.warn('[Crypto] Could not persist master key file:', e);
  }

  cachedMasterKey = newKey;
  return cachedMasterKey;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns serialized format: `iv:tag:ciphertext` (hex encoded).
 */
export function encryptSecret(plaintext: string, key?: Buffer): string {
  const encKey = key || getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypt a serialized AES-256-GCM secret string (`iv:tag:ciphertext`).
 */
export function decryptSecret(serialized: string, key?: Buffer): string {
  if (!serialized || !serialized.includes(':')) {
    throw new Error('Invalid encrypted payload format');
  }

  const parts = serialized.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected iv:tag:ciphertext');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const decKey = key || getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, decKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates standard masked secret representation for UI display.
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return '••••••••';
  if (plaintext.length <= 4) return '••••••••';
  const visiblePrefix = plaintext.substring(0, 2);
  const visibleSuffix = plaintext.substring(plaintext.length - 2);
  return `${visiblePrefix}${'•'.repeat(Math.min(plaintext.length - 4, 16))}${visibleSuffix}`;
}
