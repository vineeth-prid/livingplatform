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
      // SIGNED_URL_EXPIRY is canonical; STORAGE_SIGNED_URL_TTL kept for back-compat.
      signedUrlTtl: Number(env.SIGNED_URL_EXPIRY ?? env.STORAGE_SIGNED_URL_TTL ?? 900),
      s3: {
        endpoint: env.MINIO_ENDPOINT ?? '',
        port: Number(env.MINIO_PORT ?? 9000),
        ssl: String(env.MINIO_SSL) === 'true',
        accessKey: env.MINIO_ACCESS_KEY ?? '',
        secretKey: env.MINIO_SECRET_KEY ?? '',
        bucket: env.MINIO_BUCKET || env.STORAGE_BUCKET || 'living',
        region: env.MINIO_REGION ?? 'us-east-1',
        forcePathStyle: String(env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false',
      },
    },
  };
}

export type AppConfig = ReturnType<typeof configuration>;
