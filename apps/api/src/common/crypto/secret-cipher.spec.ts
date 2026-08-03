import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

import { maskSecret, safeEqual, SecretCipher } from './secret-cipher';

const configWith = (encryptionKey: string) =>
  ({ get: () => ({ encryptionKey }) }) as unknown as ConfigService<never, true>;

const KEY = 'a-test-encryption-key-at-least-32-chars';

describe('SecretCipher', () => {
  const cipher = new SecretCipher(configWith(KEY));

  it('round-trips a secret', () => {
    const plain = 'rzp_live_supersecretvalue';
    expect(cipher.decrypt(cipher.encrypt(plain))).toBe(plain);
  });

  it('produces a different ciphertext every time (random nonce)', () => {
    const a = cipher.encrypt('same');
    const b = cipher.encrypt('same');
    expect(a).not.toBe(b);
    expect(cipher.decrypt(a)).toBe(cipher.decrypt(b));
  });

  it('stores a versioned, non-plaintext payload', () => {
    const payload = cipher.encrypt('rzp_live_secret');
    expect(payload.startsWith('v1:')).toBe(true);
    expect(payload).not.toContain('rzp_live_secret');
    expect(payload.split(':')).toHaveLength(4);
  });

  it('refuses a ciphertext produced with a different key', () => {
    const other = new SecretCipher(configWith('a-completely-different-key-32-chars-x'));
    expect(() => other.decrypt(cipher.encrypt('secret'))).toThrow(InternalServerErrorException);
  });

  it('refuses a tampered ciphertext (GCM auth tag)', () => {
    const payload = cipher.encrypt('secret');
    const [v, iv, tag, data] = payload.split(':');
    const flipped = `${data.slice(0, -2)}${data.slice(-2) === 'AA' ? 'AB' : 'AA'}`;
    expect(() => cipher.decrypt(`${v}:${iv}:${tag}:${flipped}`)).toThrow(
      InternalServerErrorException,
    );
  });

  it('rejects a malformed payload', () => {
    expect(() => cipher.decrypt('not-a-payload')).toThrow(InternalServerErrorException);
  });

  it('handles unicode and long values', () => {
    const plain = `secret-${'x'.repeat(500)}-₹–ü`;
    expect(cipher.decrypt(cipher.encrypt(plain))).toBe(plain);
  });

  it('returns null rather than throwing for an absent value', () => {
    expect(cipher.decryptOrNull(null)).toBeNull();
    expect(cipher.decryptOrNull(undefined)).toBeNull();
  });

  describe('without APP_ENCRYPTION_KEY', () => {
    const unconfigured = new SecretCipher(configWith(''));

    it('reports itself unconfigured instead of failing boot', () => {
      expect(unconfigured.isConfigured).toBe(false);
    });

    it('fails the operation, not the process', () => {
      expect(() => unconfigured.encrypt('x')).toThrow(InternalServerErrorException);
    });
  });
});

describe('safeEqual', () => {
  it('matches identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('rejects different strings of equal length', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(safeEqual('abc', 'abcdef')).toBe(false);
  });
});

describe('maskSecret', () => {
  it('keeps only the tail visible', () => {
    expect(maskSecret('rzp_test_ABCDEFGH')).toBe('••••••••EFGH');
  });

  it('fully masks a short value', () => {
    expect(maskSecret('abc')).toBe('•••');
  });

  it('passes null through', () => {
    expect(maskSecret(null)).toBeNull();
  });
});
