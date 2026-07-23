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
    email: {
      // Active provider — the ONLY thing that decides SES vs SMTP.
      provider: (env.EMAIL_PROVIDER ?? 'smtp').toLowerCase(),
      defaultLocale: env.EMAIL_DEFAULT_LOCALE ?? 'en',
      ses: {
        region: env.AWS_REGION ?? 'us-east-1',
        accessKeyId: env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? '',
        fromName: env.SES_FROM_NAME ?? 'Living',
        fromEmail: env.SES_FROM_EMAIL ?? '',
        replyTo: env.SES_REPLY_TO ?? '',
        configurationSet: env.SES_CONFIGURATION_SET ?? '',
      },
      smtp: {
        host: env.SMTP_HOST ?? 'localhost',
        port: Number(env.SMTP_PORT ?? 1025),
        secure: String(env.SMTP_SECURE ?? '') === 'true' || Number(env.SMTP_PORT ?? 1025) === 465,
        username: env.SMTP_USERNAME ?? env.SMTP_USER ?? '',
        password: env.SMTP_PASSWORD ?? '',
        fromName: env.SMTP_FROM_NAME ?? 'Living',
        fromEmail: env.SMTP_FROM_EMAIL ?? '',
        replyTo: env.SMTP_REPLY_TO ?? '',
      },
      queue: {
        concurrency: Number(env.EMAIL_QUEUE_CONCURRENCY ?? 5),
        attempts: Number(env.EMAIL_MAX_ATTEMPTS ?? 5),
        // Per-attempt delays (ms): 1m, 5m, 15m, 1h. Exhausting them → DLQ.
        backoffMs: (env.EMAIL_RETRY_BACKOFF_MS ?? '60000,300000,900000,3600000')
          .split(',')
          .map((n) => Number(n.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0),
      },
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
