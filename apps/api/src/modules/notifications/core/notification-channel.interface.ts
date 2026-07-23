import type { Readable } from 'node:stream';

/**
 * Channel-agnostic notification contract. Every channel (email, whatsapp, and
 * future push/sms/…) implements INotificationChannel; the Notification Engine
 * core (dispatcher, queue, retry, tracking, metrics) depends ONLY on this — never
 * on a concrete provider.
 */

export type NotificationChannelName = 'email' | 'whatsapp';

/** Attachment / media, sourced from buffer, stream, file path, or a remote URL. */
export interface NotificationAttachment {
  filename: string;
  contentType?: string;
  content?: Buffer | Readable | string;
  path?: string;
  /** Remote media URL (used by WhatsApp media messages). */
  url?: string;
  cid?: string;
  encoding?: 'base64' | 'utf-8' | 'binary';
}

export type NotificationPriority = 'high' | 'normal' | 'low';

/** The canonical, channel-agnostic message the engine passes around. */
export interface NotificationMessage {
  channel: NotificationChannelName;
  /** Resolved channel addresses (emails, or E.164 phone numbers). */
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  attachments?: NotificationAttachment[];
  replyTo?: string | string[];
  priority?: NotificationPriority;
  headers?: Record<string, string>;
  from?: string;
  /** Channel-specific payload (e.g. WhatsApp template name/components, interactive). */
  channelData?: Record<string, unknown>;
}

export interface DeliveryResult {
  messageId: string | null;
  provider: string;
  channel: NotificationChannelName;
  raw?: unknown;
}

export type ChannelHealthState = 'healthy' | 'unhealthy';

export interface ChannelHealth {
  state: ChannelHealthState;
  channel: NotificationChannelName;
  provider: string;
  reason?: string;
  latencyMs?: number;
}

/**
 * A notification channel. `send` performs one delivery attempt (retries are the
 * engine's job). `supports(feature)` lets the dispatcher/UI feature-detect
 * (e.g. 'attachments', 'html', 'interactive', 'media', 'read-receipts').
 */
export interface INotificationChannel {
  readonly channel: NotificationChannelName;
  /** Active provider identifier, e.g. 'ses', 'smtp', 'meta'. */
  readonly provider: string;

  send(message: NotificationMessage): Promise<DeliveryResult>;
  verify(): Promise<boolean>;
  health(): Promise<ChannelHealth>;
  close(): Promise<void>;
  supports(feature: string): boolean;
}
