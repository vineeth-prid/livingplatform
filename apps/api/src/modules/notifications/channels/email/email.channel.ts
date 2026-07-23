import { Injectable } from '@nestjs/common';

import type {
  ChannelHealth, DeliveryResult, INotificationChannel, NotificationMessage,
} from '../../core/notification-channel.interface';
import { EmailProviderRegistry } from './email-provider.registry';
import type { EmailAttachment, EmailMessage } from './email-provider.interface';

const SUPPORTED = new Set(['html', 'text', 'attachments', 'cc', 'bcc', 'reply-to', 'headers', 'multiple-recipients']);

/**
 * Email as a notification channel. A thin adapter over the REUSED email provider
 * stack (EmailProviderRegistry → SES/SMTP providers): it maps the channel-
 * agnostic NotificationMessage onto the existing EmailMessage and delegates.
 * Nothing about SES/SMTP/templates/config was rewritten — only wrapped.
 */
@Injectable()
export class EmailChannel implements INotificationChannel {
  readonly channel = 'email' as const;

  constructor(private readonly registry: EmailProviderRegistry) {}

  get provider(): string {
    return this.registry.current.name;
  }

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    const result = await this.registry.current.send(toEmailMessage(message));
    return { messageId: result.messageId, provider: result.provider, channel: this.channel, raw: result.raw };
  }

  verify(): Promise<boolean> {
    return this.registry.current.verify();
  }

  async health(): Promise<ChannelHealth> {
    const h = await this.registry.current.health();
    return { state: h.state, channel: this.channel, provider: h.provider, reason: h.reason, latencyMs: h.latencyMs };
  }

  close(): Promise<void> {
    return this.registry.current.close();
  }

  supports(feature: string): boolean {
    return SUPPORTED.has(feature);
  }

  // ── Provider controls surfaced to the admin API (email-specific) ──
  get configuredProvider(): string {
    return this.registry.configured;
  }
  get isOverridden(): boolean {
    return this.registry.isOverridden;
  }
  switchProvider(name: string): Promise<{ name: string }> {
    return this.registry.switchTo(name);
  }
}

function toEmailMessage(m: NotificationMessage): EmailMessage {
  return {
    to: m.to,
    cc: m.cc,
    bcc: m.bcc,
    subject: m.subject ?? '',
    html: m.html,
    text: m.text,
    replyTo: m.replyTo,
    priority: m.priority,
    headers: m.headers,
    from: m.from,
    attachments: m.attachments?.map(
      (a): EmailAttachment => ({
        filename: a.filename,
        contentType: a.contentType,
        content: a.content,
        path: a.path,
        cid: a.cid,
        encoding: a.encoding,
      }),
    ),
  };
}
