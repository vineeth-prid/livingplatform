import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/configuration';
import type {
  ChannelHealth, DeliveryResult, INotificationChannel, NotificationMessage,
} from '../../core/notification-channel.interface';
import { WhatsAppProviderFactory } from './whatsapp-provider.factory';
import type {
  WaInteractive, WaLocation, WaMedia, WaSendResult, WaTemplate, WhatsAppProvider,
} from './whatsapp-provider.interface';

const SUPPORTED = new Set([
  'text', 'template', 'media', 'image', 'video', 'audio', 'document',
  'interactive', 'buttons', 'list', 'location', 'contacts',
  'read-receipts', 'media-upload', 'multiple-recipients',
]);

/**
 * WhatsApp as a notification channel over the Meta Cloud API. `send` reads
 * `message.channelData.kind` to pick the WhatsApp message type (text | template
 * | media | interactive | location | contacts), defaulting to a text message
 * from `message.text`. Implements the same INotificationChannel as email, so the
 * shared dispatcher/queue/retry/tracking treat both identically.
 */
@Injectable()
export class WhatsAppChannel implements INotificationChannel, OnModuleDestroy {
  readonly channel = 'whatsapp' as const;
  private readonly whatsapp: WhatsAppProvider;

  constructor(config: ConfigService<AppConfig, true>) {
    this.whatsapp = WhatsAppProviderFactory.create(config);
  }

  get provider(): string {
    return this.whatsapp.name;
  }

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    const recipients = (Array.isArray(message.to) ? message.to : [message.to]).filter(Boolean);
    if (recipients.length === 0) throw new BadRequestException('WhatsApp requires at least one recipient');

    const data = (message.channelData ?? {}) as Record<string, unknown>;
    const kind = (data.kind as string) ?? 'text';

    // One send per recipient (WhatsApp is 1:1); the first id represents the batch.
    const results: WaSendResult[] = [];
    for (const to of recipients) {
      results.push(await this.sendOne(kind, to, message, data));
    }
    return { messageId: results[0]?.messageId ?? null, provider: this.provider, channel: this.channel, raw: results.map((r) => r.raw) };
  }

  private sendOne(kind: string, to: string, message: NotificationMessage, data: Record<string, unknown>): Promise<WaSendResult> {
    switch (kind) {
      case 'template':
        return this.whatsapp.sendTemplate(to, data.template as WaTemplate);
      case 'media':
        return this.whatsapp.sendMedia(to, data.media as WaMedia);
      case 'interactive':
        return this.whatsapp.sendInteractive(to, data.interactive as WaInteractive);
      case 'location':
        return this.whatsapp.sendLocation(to, data.location as WaLocation);
      case 'contacts':
        return this.whatsapp.sendContacts(to, (data.contacts as unknown[]) ?? []);
      case 'text':
      default: {
        const body = message.text ?? message.subject ?? '';
        if (!body) throw new BadRequestException('WhatsApp text message requires body text');
        return this.whatsapp.sendText(to, body, Boolean(data.previewUrl));
      }
    }
  }

  verify(): Promise<boolean> {
    return this.whatsapp.verify();
  }

  async health(): Promise<ChannelHealth> {
    const h = await this.whatsapp.health();
    return { state: h.state, channel: this.channel, provider: h.provider, reason: h.reason, latencyMs: h.latencyMs };
  }

  close(): Promise<void> {
    return this.whatsapp.close();
  }

  onModuleDestroy(): Promise<void> {
    return this.whatsapp.close().catch(() => undefined);
  }

  supports(feature: string): boolean {
    return SUPPORTED.has(feature);
  }

  // ── Extras used by the webhook / admin (whatsapp-specific) ──
  uploadMedia(content: Buffer, contentType: string, filename?: string): Promise<string> {
    return this.whatsapp.uploadMedia(content, contentType, filename);
  }
  markRead(messageId: string): Promise<void> {
    return this.whatsapp.markRead(messageId);
  }
}
