import 'reflect-metadata';

import { configuration } from './configuration';
import { validateEnv } from './env.validation';

/**
 * The reason this exists. ThrottlerGuard keys its buckets on `req.ip`, and
 * Express reports the proxy's address there unless it is told the hop count.
 * Set this wrong low and every user on the platform shares one rate-limit
 * bucket — 5 logins a minute for everybody, not per person. Set it wrong high
 * and a client forges X-Forwarded-For to pick its own bucket. So the value has
 * to survive the env round-trip exactly as written.
 */
describe('TRUST_PROXY', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost:5432/living',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
    JWT_REFRESH_SECRET: 'x'.repeat(32),
  };

  afterEach(() => {
    delete process.env.TRUST_PROXY;
  });

  it('defaults to 0 — no proxy assumed', () => {
    expect(validateEnv(base).TRUST_PROXY).toBe(0);
  });

  it.each([
    ['1', 1], // nginx only
    ['2', 2], // Cloudflare in front of nginx
  ])('carries %s through as the number %i', (raw, expected) => {
    expect(validateEnv({ ...base, TRUST_PROXY: raw }).TRUST_PROXY).toBe(expected);
    process.env.TRUST_PROXY = raw;
    expect(configuration().trustProxy).toBe(expected);
  });

  it('rejects a negative hop count rather than silently trusting nothing', () => {
    expect(() => validateEnv({ ...base, TRUST_PROXY: '-1' })).toThrow();
  });

  it('rejects a non-numeric value instead of coercing it to 0', () => {
    // 'true' is the tempting Express idiom and it means "trust every hop" —
    // exactly the setting that lets a client spoof its own address.
    expect(() => validateEnv({ ...base, TRUST_PROXY: 'true' })).toThrow();
  });
});
