import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Documented one-time password for provisioned accounts, so a dev environment
 * works out of the box. Production must override it via AUTH_DEFAULT_PASSWORD —
 * enforced below, because a default published in this repo is claimable by
 * anyone who logs in before the real user does.
 */
export const DOCUMENTED_DEFAULT_PASSWORD = 'Living@123';

export enum EmailProvider {
  Ses = 'ses',
  Smtp = 'smtp',
}

/**
 * The full set of environment variables the API needs, validated at boot.
 * A missing or malformed required variable fails fast with a clear message —
 * the app never starts in a half-configured state.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  PORT = 4000;

  @IsString()
  @IsOptional()
  API_PREFIX = 'api';

  @IsString()
  @IsOptional()
  CORS_ORIGINS = 'http://localhost:5173';

  /**
   * How many reverse proxies sit in front of this process, counted from the
   * socket outwards. Rate limiting keys on the client IP, so this has to match
   * the real chain: nginx alone is 1, Cloudflare in front of nginx is 2, no
   * proxy at all is 0. Too low collapses every user into one shared rate-limit
   * bucket; too high lets a client forge X-Forwarded-For and pick its own key.
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  TRUST_PROXY = 0;

  /** Force-enable Swagger in production ('true'); disabled there by default. */
  @IsString()
  @IsOptional()
  SWAGGER_ENABLED = 'false';

  /** When set, /metrics requires `Authorization: Bearer <token>`. */
  @IsString()
  @IsOptional()
  METRICS_TOKEN = '';

  /** 'true' enables Postgres RLS tenant-GUC propagation (see prisma/rls/ACTIVATE.sql). */
  @IsString()
  @IsOptional()
  DB_RLS_ENABLED = 'false';

  // ── Database / cache ──
  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  REDIS_URL = 'redis://localhost:6379';

  // ── Auth ──
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL = '7d';

  /** Refresh TTL when "remember me" is set. */
  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL_REMEMBER = '30d';

  /**
   * One-time password given to provisioned people accounts (residents, staff,
   * vendors). Users are forced to change it on first login. Configurable so
   * production never ships with the documented default.
   */
  @IsString()
  @MinLength(8, { message: 'AUTH_DEFAULT_PASSWORD must be at least 8 characters' })
  @IsOptional()
  AUTH_DEFAULT_PASSWORD = DOCUMENTED_DEFAULT_PASSWORD;

  /** Number of previous passwords that may not be reused (0 disables). */
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  AUTH_PASSWORD_HISTORY_SIZE = 5;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  AUTH_PASSWORD_MIN_LENGTH = 8;

  /** Lifetime of the mobile password-reset OTP. */
  @IsString()
  @IsOptional()
  AUTH_OTP_TTL = '10m';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  AUTH_OTP_LENGTH = 6;

  // ── Secret encryption (payment keys, webhook secrets, WhatsApp API keys) ──
  /**
   * Passphrase for AES-256-GCM encryption of secret columns. REQUIRED in
   * production — without it, saving a Razorpay key or WhatsApp API key fails.
   */
  @ValidateIf((e: EnvironmentVariables) => e.NODE_ENV === NodeEnv.Production)
  @IsString()
  @MinLength(32, {
    message: 'APP_ENCRYPTION_KEY must be at least 32 characters in production',
  })
  APP_ENCRYPTION_KEY = '';

  // ── Email (verification / password reset) ──
  @IsString()
  @IsOptional()
  SMTP_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SMTP_PORT = 1025;

  @IsString()
  @IsOptional()
  SMTP_USER = '';

  @IsString()
  @IsOptional()
  SMTP_PASSWORD = '';

  @IsString()
  @IsOptional()
  MAIL_FROM = 'Living <no-reply@living.local>';

  /** Base URL of the web app, used to build verification / reset links. */
  @IsString()
  @IsOptional()
  WEB_APP_URL = 'http://localhost:5173';

  // ── Notification Engine · Email Service ──
  /** Active email provider — the ONLY switch between SES and SMTP. */
  @IsEnum(EmailProvider)
  @IsOptional()
  EMAIL_PROVIDER: EmailProvider = EmailProvider.Smtp;

  @IsString()
  @IsOptional()
  EMAIL_DEFAULT_LOCALE = 'en';

  // Amazon SES (required only when EMAIL_PROVIDER=ses).
  @IsString()
  @IsOptional()
  AWS_REGION = 'us-east-1';

  @ValidateIf((e: EnvironmentVariables) => e.EMAIL_PROVIDER === EmailProvider.Ses)
  @IsString()
  @MinLength(1, { message: 'AWS_ACCESS_KEY_ID is required when EMAIL_PROVIDER=ses' })
  AWS_ACCESS_KEY_ID = '';

  @ValidateIf((e: EnvironmentVariables) => e.EMAIL_PROVIDER === EmailProvider.Ses)
  @IsString()
  @MinLength(1, { message: 'AWS_SECRET_ACCESS_KEY is required when EMAIL_PROVIDER=ses' })
  AWS_SECRET_ACCESS_KEY = '';

  @ValidateIf((e: EnvironmentVariables) => e.EMAIL_PROVIDER === EmailProvider.Ses)
  @IsString()
  @MinLength(1, { message: 'SES_FROM_EMAIL is required when EMAIL_PROVIDER=ses' })
  SES_FROM_EMAIL = '';

  @IsString()
  @IsOptional()
  SES_FROM_NAME = 'Living';

  @IsString()
  @IsOptional()
  SES_REPLY_TO = '';

  @IsString()
  @IsOptional()
  SES_CONFIGURATION_SET = '';

  // SMTP (spec adds secure/username/from-name/from-email/reply-to on top of the
  // existing SMTP_HOST/PORT/PASSWORD used by the legacy MailService).
  @IsString()
  @IsOptional()
  SMTP_SECURE = 'false';

  @IsString()
  @IsOptional()
  SMTP_USERNAME = '';

  @IsString()
  @IsOptional()
  SMTP_FROM_NAME = 'Living';

  @IsString()
  @IsOptional()
  SMTP_FROM_EMAIL = '';

  @IsString()
  @IsOptional()
  SMTP_REPLY_TO = '';

  // Queue / retry.
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  EMAIL_QUEUE_CONCURRENCY = 5;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  EMAIL_MAX_ATTEMPTS = 5;

  @IsString()
  @IsOptional()
  EMAIL_RETRY_BACKOFF_MS = '60000,300000,900000,3600000';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  NOTIFICATION_QUEUE_CONCURRENCY = 5;

  // ── WhatsApp channel (Meta Cloud API) ──
  @IsString()
  @IsOptional()
  WHATSAPP_PROVIDER = 'meta';

  @IsString()
  @IsOptional()
  WHATSAPP_API_VERSION = 'v21.0';

  @IsString()
  @IsOptional()
  WHATSAPP_GRAPH_BASE_URL = 'https://graph.facebook.com';

  @IsString()
  @IsOptional()
  WHATSAPP_PHONE_NUMBER_ID = '';

  @IsString()
  @IsOptional()
  WHATSAPP_ACCESS_TOKEN = '';

  @IsString()
  @IsOptional()
  WHATSAPP_BUSINESS_ACCOUNT_ID = '';

  @IsString()
  @IsOptional()
  WHATSAPP_VERIFY_TOKEN = '';

  @IsString()
  @IsOptional()
  WHATSAPP_APP_SECRET = '';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  WHATSAPP_RATE_LIMIT_PER_MINUTE = 60;

  // ── WhatsApp channel · OpenWA gateway (WHATSAPP_PROVIDER=openwa) ──
  /** Base URL of the self-hosted OpenWA gateway, e.g. http://openwa:3000 */
  @ValidateIf((e: EnvironmentVariables) => e.WHATSAPP_PROVIDER === 'openwa')
  @IsString()
  @MinLength(1, { message: 'OPENWA_BASE_URL is required when WHATSAPP_PROVIDER=openwa' })
  OPENWA_BASE_URL = 'http://localhost:3000';

  /** Gateway API key sent as X-API-Key. Session-scoped OPERATOR key recommended. */
  @ValidateIf((e: EnvironmentVariables) => e.WHATSAPP_PROVIDER === 'openwa')
  @IsString()
  @MinLength(1, { message: 'OPENWA_API_KEY is required when WHATSAPP_PROVIDER=openwa' })
  OPENWA_API_KEY = '';

  /** Default gateway session name the platform sends from. */
  @IsString()
  @IsOptional()
  OPENWA_SESSION = 'living';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  OPENWA_TIMEOUT_MS = 20000;

  /** Shared secret OpenWA signs webhook deliveries with. */
  @IsString()
  @IsOptional()
  OPENWA_WEBHOOK_SECRET = '';

  /**
   * Callback URL the gateway posts events to. Usually an INTERNAL address
   * (http://api:4000/api/v1/notifications/webhooks/openwa) — left empty, the
   * platform skips webhook registration and relies on the status watchdog.
   */
  @IsString()
  @IsOptional()
  OPENWA_WEBHOOK_URL = '';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  OPENWA_HEALTH_INTERVAL_SEC = 60;

  @IsString()
  @IsOptional()
  OPENWA_AUTO_RECONNECT = 'true';

  @IsString()
  @IsOptional()
  OPENWA_DEFAULT_COUNTRY_CODE = '91';

  // ── Payments (Razorpay; per-community accounts live in the database) ──
  @IsString()
  @IsOptional()
  PAYMENT_GATEWAY = 'razorpay';

  @IsString()
  @IsOptional()
  PAYMENT_CURRENCY = 'INR';

  @IsString()
  @IsOptional()
  RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  RAZORPAY_TIMEOUT_MS = 15000;

  @IsString()
  @IsOptional()
  BILLING_INVOICE_PREFIX = 'INV';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  BILLING_DEFAULT_DUE_DAY = 10;

  // ── Rate limiting ──
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  THROTTLE_TTL = 60;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  THROTTLE_LIMIT = 120;

  // ── Storage (S3/Azure/GCS-ready; 'local' stub by default this sprint) ──
  @IsString()
  @IsOptional()
  STORAGE_DRIVER = 'local';

  @IsString()
  @IsOptional()
  STORAGE_BUCKET = 'living-local';

  @IsString()
  @IsOptional()
  STORAGE_PUBLIC_URL = 'http://localhost:4000/storage';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  STORAGE_SIGNED_URL_TTL = 900;

  // ── Web Push / VAPID (Gate Management, Sprint 13) ──
  // All optional. Leave unset and the push channel simply reports unhealthy and
  // sends nothing — in-app, WhatsApp and email are unaffected. Generate with:
  //   npx web-push generate-vapid-keys
  @IsString()
  @IsOptional()
  VAPID_PUBLIC_KEY = '';

  @IsString()
  @IsOptional()
  VAPID_PRIVATE_KEY = '';

  @IsString()
  @IsOptional()
  VAPID_SUBJECT = 'mailto:support@living.local';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  PUSH_TTL = 900;

  // ── S3 / MinIO (required only when STORAGE_DRIVER=s3; validated + fail-fast) ──
  /** MinIO/S3 host WITHOUT scheme, e.g. "minio" (compose) or "s3.example.com". */
  @ValidateIf((e: EnvironmentVariables) => e.STORAGE_DRIVER === 's3')
  @IsString()
  @MinLength(1, { message: 'MINIO_ENDPOINT is required when STORAGE_DRIVER=s3' })
  MINIO_ENDPOINT = '';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  MINIO_PORT = 9000;

  /** 'true' for HTTPS endpoints. */
  @IsString()
  @IsOptional()
  MINIO_SSL = 'false';

  @ValidateIf((e: EnvironmentVariables) => e.STORAGE_DRIVER === 's3')
  @IsString()
  @MinLength(1, { message: 'MINIO_ACCESS_KEY is required when STORAGE_DRIVER=s3' })
  MINIO_ACCESS_KEY = '';

  @ValidateIf((e: EnvironmentVariables) => e.STORAGE_DRIVER === 's3')
  @IsString()
  @MinLength(1, { message: 'MINIO_SECRET_KEY is required when STORAGE_DRIVER=s3' })
  MINIO_SECRET_KEY = '';

  /** Falls back to STORAGE_BUCKET when unset. */
  @IsString()
  @IsOptional()
  MINIO_BUCKET = '';

  @IsString()
  @IsOptional()
  MINIO_REGION = 'us-east-1';

  /** MinIO requires path-style ('true'); real S3 uses virtual-hosted ('false'). */
  @IsString()
  @IsOptional()
  S3_FORCE_PATH_STYLE = 'true';

  /** Signed-URL lifetime (seconds); falls back to STORAGE_SIGNED_URL_TTL. */
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  SIGNED_URL_EXPIRY = 900;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.AUTH_DEFAULT_PASSWORD === DOCUMENTED_DEFAULT_PASSWORD
  ) {
    throw new Error(
      'Invalid environment configuration:\n  - AUTH_DEFAULT_PASSWORD must be overridden in production; ' +
        'the fallback is published in this repository, so every provisioned account would be claimable ' +
        'by whoever logs in first.',
    );
  }
  return validated;
}
