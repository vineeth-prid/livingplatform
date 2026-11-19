import { base32Decode, base32Encode, generateTotpSecret, totpAt, verifyTotp } from './totp';

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 Appendix B test secret "12345678901234567890" (SHA-1).
  const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

  it('matches the RFC 6238 SHA-1 test vectors (last 6 digits)', () => {
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('round-trips base32', () => {
    const buf = Buffer.from('any bytes \x00\xff');
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it('accepts the current code and ±1 step, rejects others', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(secret, totpAt(secret, step), now)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step + 3), now)).toBeNull();
    expect(verifyTotp(secret, '12345', now)).toBeNull();
  });
});
