import { DOCUMENTED_DEFAULT_PASSWORD, EnvironmentVariables } from './env.validation';

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
    /** Reverse-proxy hop count; see TRUST_PROXY. Rate limiting depends on it. */
    trustProxy: Number(env.TRUST_PROXY ?? 0),
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
      // One-time password handed to provisioned people accounts. Configurable —
      // never hardcoded in the provisioning service.
      defaultPassword: env.AUTH_DEFAULT_PASSWORD ?? DOCUMENTED_DEFAULT_PASSWORD,
      /** How many previous passwords a user may not reuse (0 disables). */
      passwordHistorySize: Number(env.AUTH_PASSWORD_HISTORY_SIZE ?? 5),
      /** Minimum password length enforced on change/reset. */
      passwordMinLength: Number(env.AUTH_PASSWORD_MIN_LENGTH ?? 8),
      /** OTP lifetime for mobile-number password reset. */
      otpTtl: env.AUTH_OTP_TTL ?? '10m',
      otpLength: Number(env.AUTH_OTP_LENGTH ?? 6),
    },
    security: {
      /** Passphrase for AES-256-GCM secret columns (SecretCipher). */
      encryptionKey: env.APP_ENCRYPTION_KEY ?? '',
    },
    payments: {
      /** Active payment gateway. Community accounts are configured per-community. */
      gateway: (env.PAYMENT_GATEWAY ?? 'razorpay').toLowerCase(),
      currency: env.PAYMENT_CURRENCY ?? 'INR',
      razorpay: {
        baseUrl: env.RAZORPAY_BASE_URL ?? 'https://api.razorpay.com/v1',
        timeoutMs: Number(env.RAZORPAY_TIMEOUT_MS ?? 15000),
      },
      /** Invoice number prefix, e.g. INV-2026-000123. */
      invoicePrefix: env.BILLING_INVOICE_PREFIX ?? 'INV',
      /** Day-of-month invoices fall due when the rate card sets no override. */
      defaultDueDay: Number(env.BILLING_DEFAULT_DUE_DAY ?? 10),
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
        // `||`, NOT `??`. Every one of these vars has a class default in
        // env.validation, so the validated object always carries `''` rather
        // than undefined — and `?? ` only falls through on null/undefined. The
        // alias was therefore unreachable: setting SMTP_USER left username
        // empty, nodemailer was handed `auth: undefined`, the session never
        // authenticated, and the mail server refused to relay with
        // "Client host rejected: Access denied" — a message that points at the
        // network and says nothing about the credentials being dropped.
        username: env.SMTP_USERNAME || env.SMTP_USER || '',
        password: env.SMTP_PASSWORD ?? '',
        fromName: env.SMTP_FROM_NAME ?? 'Living',
        fromEmail: env.SMTP_FROM_EMAIL ?? '',
        replyTo: env.SMTP_REPLY_TO ?? '',
      },
      queue: {
        // Same alias trap as SMTP_USERNAME above — a class default makes the
        // legacy name unreachable with `??`.
        concurrency: Number(env.NOTIFICATION_QUEUE_CONCURRENCY || env.EMAIL_QUEUE_CONCURRENCY || 5),
        attempts: Number(env.EMAIL_MAX_ATTEMPTS ?? 5),
        // Per-attempt delays (ms): 1m, 5m, 15m, 1h. Exhausting them → DLQ.
        backoffMs: (env.EMAIL_RETRY_BACKOFF_MS ?? '60000,300000,900000,3600000')
          .split(',')
          .map((n) => Number(n.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0),
      },
    },
    whatsapp: {
      // Active provider — currently the official Meta Cloud API.
      provider: (env.WHATSAPP_PROVIDER ?? 'meta').toLowerCase(),
      meta: {
        apiVersion: env.WHATSAPP_API_VERSION ?? 'v21.0',
        graphBaseUrl: env.WHATSAPP_GRAPH_BASE_URL ?? 'https://graph.facebook.com',
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? '',
        accessToken: env.WHATSAPP_ACCESS_TOKEN ?? '',
        businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
        // Webhook verification + signature.
        verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? '',
        appSecret: env.WHATSAPP_APP_SECRET ?? '',
      },
      // Self-hosted OpenWA gateway (github.com/rmyndharis/OpenWA).
      openwa: {
        baseUrl: (env.OPENWA_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
        apiKey: env.OPENWA_API_KEY ?? '',
        session: env.OPENWA_SESSION ?? 'living',
        timeoutMs: Number(env.OPENWA_TIMEOUT_MS ?? 20000),
        /** Shared secret OpenWA signs its webhooks with (x-webhook-signature). */
        webhookSecret: env.OPENWA_WEBHOOK_SECRET ?? '',
        /** Callback the gateway posts to, e.g. http://api:4000/api/v1/notifications/webhooks/openwa */
        webhookUrl: env.OPENWA_WEBHOOK_URL ?? '',
        /** Seconds between connection-health polls (0 disables the watchdog). */
        healthIntervalSec: Number(env.OPENWA_HEALTH_INTERVAL_SEC ?? 60),
        /** Auto-restart a session that reports disconnected. */
        autoReconnect: String(env.OPENWA_AUTO_RECONNECT ?? 'true') !== 'false',
        /** Country code prepended to 10-digit local numbers when addressing chats. */
        defaultCountryCode: env.OPENWA_DEFAULT_COUNTRY_CODE ?? '91',
      },
      /** Outbound messages per minute across the WhatsApp channel (0 = unlimited). */
      rateLimitPerMinute: Number(env.WHATSAPP_RATE_LIMIT_PER_MINUTE ?? 60),
    },
    throttle: {
      ttl: Number(env.THROTTLE_TTL ?? 60),
      limit: Number(env.THROTTLE_LIMIT ?? 120),
    },
    /**
     * Web Push (VAPID, RFC 8292) — used by the push notification channel.
     *
     * Keys are OPTIONAL by design: with none set the push channel reports
     * unhealthy and declines to send, and every other channel is unaffected.
     * That keeps this sprint deployable without a key-generation step, and
     * makes enabling push a config change rather than a code change.
     * Generate a pair with:  npx web-push generate-vapid-keys
     */
    push: {
      publicKey: env.VAPID_PUBLIC_KEY ?? '',
      privateKey: env.VAPID_PRIVATE_KEY ?? '',
      /** `mailto:` or https URL identifying the sender to the push service. */
      subject: env.VAPID_SUBJECT ?? 'mailto:support@living.local',
      /** Seconds a push service should hold an undelivered message. */
      ttl: Number(env.PUSH_TTL ?? 900),
    },
    storage: {
      driver: env.STORAGE_DRIVER ?? 'local',
      bucket: env.STORAGE_BUCKET ?? 'living-local',
      publicUrl: env.STORAGE_PUBLIC_URL ?? 'http://localhost:4000/storage',
      // SIGNED_URL_EXPIRY is canonical; STORAGE_SIGNED_URL_TTL kept for back-compat.
      signedUrlTtl: Number(env.SIGNED_URL_EXPIRY || env.STORAGE_SIGNED_URL_TTL || 900),
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
