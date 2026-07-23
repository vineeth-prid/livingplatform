import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

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
  return validated;
}
