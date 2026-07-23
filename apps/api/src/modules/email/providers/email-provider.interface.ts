import type { Readable } from 'node:stream';

/**
 * Provider-agnostic email contract. The EmailService depends ONLY on this
 * interface — never on SES or Nodemailer directly. New providers (Postmark,
 * Resend, SendGrid, Mailgun, MS Graph) implement this and register in the
 * factory; nothing else in the app changes.
 */

/** An attachment sourced from a buffer, a stream, or a local file path. */
export interface EmailAttachment {
  filename: string;
  /** MIME type, e.g. 'application/pdf', 'image/png'. */
  contentType?: string;
  /** Exactly one of content / path must be provided. */
  content?: Buffer | Readable | string;
  path?: string;
  /** For inline images referenced by CID in the HTML. */
  cid?: string;
  encoding?: 'base64' | 'utf-8' | 'binary';
}

export type EmailPriority = 'high' | 'normal' | 'low';

/** The canonical message the whole engine passes around. */
export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  /** Custom SMTP/SES headers. */
  headers?: Record<string, string>;
  replyTo?: string | string[];
  priority?: EmailPriority;
  /** Overrides the provider's configured From when set. */
  from?: string;
}

/** Result of a single send attempt. */
export interface SendResult {
  /** Provider message id, when available. */
  messageId: string | null;
  /** Provider that handled the send. */
  provider: string;
  /** Raw, provider-specific response payload (for tracking/debugging). */
  raw?: unknown;
}

export type HealthState = 'healthy' | 'unhealthy';

export interface HealthResult {
  state: HealthState;
  provider: string;
  /** Present when unhealthy — human-readable reason. */
  reason?: string;
  /** Optional latency of the health probe in ms. */
  latencyMs?: number;
}

/**
 * Every email provider implements this. `send` performs one delivery attempt
 * (retries are the queue's job, never the provider's). `verify` confirms
 * credentials/connection; `health` is a richer probe surfaced to admins;
 * `close` releases sockets/clients on shutdown.
 */
export interface EmailProvider {
  /** Stable identifier, e.g. 'ses', 'smtp'. */
  readonly name: string;

  send(message: EmailMessage): Promise<SendResult>;

  /** Cheap connectivity/credential check — throws or resolves false on failure. */
  verify(): Promise<boolean>;

  /** Richer probe returning a structured healthy/unhealthy result. */
  health(): Promise<HealthResult>;

  /** Release any held resources (sockets, SDK clients). */
  close(): Promise<void>;
}

/** DI token for the bound EmailProvider implementation. */
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
