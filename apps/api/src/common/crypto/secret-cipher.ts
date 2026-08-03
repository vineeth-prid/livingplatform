import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const PREFIX = 'v1';

/**
 * The single place the platform encrypts secrets at rest — Razorpay key
 * secrets, webhook signing secrets and WhatsApp gateway API keys.
 *
 * AES-256-GCM (authenticated) with a random nonce per encryption. The stored
 * form is `v1:<iv>:<tag>:<ciphertext>`, all base64url, so the scheme can be
 * rotated later without ambiguity. The key comes from APP_ENCRYPTION_KEY and is
 * never logged; a missing key fails the *operation*, not boot, so a deployment
 * that never touches secrets still runs (see docs/deployment.md).
 *
 * ponytail: one key for every secret column. Add a key-id column and a keyring
 * here if per-tenant keys or scheduled rotation are ever required.
 */
@Injectable()
export class SecretCipher {
  private readonly logger = new Logger(SecretCipher.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService<AppConfig, true>) {
    this.key = deriveKey(config.get('security', { infer: true }).encryptionKey);
    if (!this.key) {
      this.logger.warn(
        'APP_ENCRYPTION_KEY is not set — payment/WhatsApp secrets cannot be stored until it is',
      );
    }
  }

  get isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [PREFIX, b64(iv), b64(cipher.getAuthTag()), b64(enc)].join(':');
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const [version, ivB64, tagB64, dataB64] = payload.split(':');
    if (version !== PREFIX || !ivB64 || !tagB64 || !dataB64) {
      throw new InternalServerErrorException('Stored secret is malformed');
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, unb64(ivB64));
      decipher.setAuthTag(unb64(tagB64));
      return Buffer.concat([decipher.update(unb64(dataB64)), decipher.final()]).toString('utf8');
    } catch {
      // Wrong key or tampered ciphertext — never echo the payload.
      throw new InternalServerErrorException('Stored secret could not be decrypted');
    }
  }

  /** Decrypt, returning null instead of throwing when the value is absent. */
  decryptOrNull(payload: string | null | undefined): string | null {
    return payload ? this.decrypt(payload) : null;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new InternalServerErrorException(
        'APP_ENCRYPTION_KEY is not configured — cannot handle encrypted secrets',
      );
    }
    return this.key;
  }
}

/** SHA-256 of the passphrase → a stable 32-byte key. */
function deriveKey(raw: string | undefined): Buffer | null {
  if (!raw || raw.trim().length === 0) return null;
  return createHash('sha256').update(raw.trim(), 'utf8').digest();
}

function b64(buf: Buffer): string {
  return buf.toString('base64url');
}

function unb64(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/**
 * Constant-time comparison of two hex/ASCII signatures. Used by the Razorpay
 * and WhatsApp webhook verifiers — never use `===` on a signature.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** `rzp_live_ABC…XYZ` → `rzp_live_…XYZ`. Safe to show in an admin UI. */
export function maskSecret(value: string | null | undefined, keepTail = 4): string | null {
  if (!value) return null;
  if (value.length <= keepTail) return '•'.repeat(value.length);
  return `${'•'.repeat(Math.min(8, value.length - keepTail))}${value.slice(-keepTail)}`;
}
