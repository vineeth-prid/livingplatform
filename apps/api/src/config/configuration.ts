import { EnvironmentVariables } from './env.validation';

/**
 * Structured, typed configuration derived from validated env vars.
 * Registered with @nestjs/config; consume via `ConfigService.get('auth', …)`
 * with strong types (see AppConfig).
 */
export function configuration() {
  const env = process.env as unknown as EnvironmentVariables;
  return {
    env: env.NODE_ENV,
    port: Number(env.PORT ?? 4000),
    apiPrefix: env.API_PREFIX ?? 'api',
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    webAppUrl: env.WEB_APP_URL,
    database: {
      url: env.DATABASE_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: env.JWT_REFRESH_TTL ?? '7d',
      refreshTtlRemember: env.JWT_REFRESH_TTL_REMEMBER ?? '30d',
    },
    mail: {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 1025),
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    },
    throttle: {
      ttl: Number(env.THROTTLE_TTL ?? 60),
      limit: Number(env.THROTTLE_LIMIT ?? 120),
    },
    storage: {
      driver: env.STORAGE_DRIVER ?? 'local',
      bucket: env.STORAGE_BUCKET ?? 'living-local',
      publicUrl: env.STORAGE_PUBLIC_URL ?? 'http://localhost:4000/storage',
      signedUrlTtl: Number(env.STORAGE_SIGNED_URL_TTL ?? 900),
    },
  };
}

export type AppConfig = ReturnType<typeof configuration>;
