import 'reflect-metadata'; // class-validator decorators; main.ts pulls this in at runtime.

import { validateEnv } from './env.validation';

const SECRET = 'x'.repeat(32);

const baseEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/living',
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: SECRET,
};

const prodEnv = {
  ...baseEnv,
  NODE_ENV: 'production',
  APP_ENCRYPTION_KEY: SECRET,
};

describe('one-time passwords (no shared default)', () => {
  /**
   * Provisioned accounts now each get their own random one-time password, so
   * there is no shared AUTH_DEFAULT_PASSWORD left to configure — production
   * boots without it, and a stale value left in an old .env is simply ignored.
   */
  it('boots production without AUTH_DEFAULT_PASSWORD', () => {
    expect(() => validateEnv(prodEnv)).not.toThrow();
  });

  it('ignores a leftover AUTH_DEFAULT_PASSWORD', () => {
    expect(() => validateEnv({ ...prodEnv, AUTH_DEFAULT_PASSWORD: 'Living@123' })).not.toThrow();
  });
});
