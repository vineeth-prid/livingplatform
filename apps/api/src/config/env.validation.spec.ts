import 'reflect-metadata'; // class-validator decorators; main.ts pulls this in at runtime.

import { DOCUMENTED_DEFAULT_PASSWORD, validateEnv } from './env.validation';

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

describe('AUTH_DEFAULT_PASSWORD', () => {
  /**
   * The reason this exists. The fallback is published in this repository, so a
   * production deploy that never sets AUTH_DEFAULT_PASSWORD hands every
   * provisioned resident, staff and vendor an account that whoever logs in
   * first can claim. Force-change-on-first-login narrows that window; it does
   * not close it. Boot must fail instead.
   */
  it('refuses to boot production on the documented default', () => {
    expect(() => validateEnv(prodEnv)).toThrow(/AUTH_DEFAULT_PASSWORD must be overridden/);
    expect(() =>
      validateEnv({ ...prodEnv, AUTH_DEFAULT_PASSWORD: DOCUMENTED_DEFAULT_PASSWORD }),
    ).toThrow(/AUTH_DEFAULT_PASSWORD must be overridden/);
  });

  it('accepts an overridden password in production', () => {
    expect(
      validateEnv({ ...prodEnv, AUTH_DEFAULT_PASSWORD: 'a-different-one-time-password' })
        .AUTH_DEFAULT_PASSWORD,
    ).toBe('a-different-one-time-password');
  });

  it('leaves development on the documented default so it works out of the box', () => {
    expect(validateEnv(baseEnv).AUTH_DEFAULT_PASSWORD).toBe(DOCUMENTED_DEFAULT_PASSWORD);
  });

  /** The guard runs after the field validators, so it must not mask them. */
  it('still enforces the 8-character minimum', () => {
    expect(() => validateEnv({ ...baseEnv, AUTH_DEFAULT_PASSWORD: 'short' })).toThrow(
      /at least 8 characters/,
    );
    expect(() => validateEnv({ ...prodEnv, AUTH_DEFAULT_PASSWORD: 'short' })).toThrow(
      /at least 8 characters/,
    );
  });
});
