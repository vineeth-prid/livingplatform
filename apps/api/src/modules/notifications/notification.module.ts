import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { NOTIFICATION_DLQ, NOTIFICATION_QUEUE } from './notification.constants';
import { NotificationController } from './admin/notification.controller';
import { EmailChannel } from './channels/email/email.channel';
import { EmailProviderRegistry } from './channels/email/email-provider.registry';
import { WhatsAppChannel } from './channels/whatsapp/whatsapp.channel';
import { ChannelRouter } from './core/channel-router';
import { DeliveryTracker } from './core/delivery-tracker';
import { NotificationDispatcher } from './core/notification.dispatcher';
import { NotificationHistory } from './core/notification-history.service';
import { NotificationMetrics } from './core/notification-metrics.service';
import { NotificationProcessor } from './core/notification.processor';
import { RecipientResolver } from './core/recipient-resolver';
import { EmailTemplateEngine } from './core/templates/template.engine';
import { NOTIFICATION_CHANNEL_LIST } from './factories/notification-channel.factory';
import { MetaWebhookController } from './webhooks/meta-webhook.controller';
import { MetaWebhookService } from './webhooks/meta-webhook.service';

/** Own BullMQ connection (not shared with the app RedisService — BullMQ needs
 *  maxRetriesPerRequest:null + blocking commands). */
function bullConnection(config: ConfigService<AppConfig, true>) {
  const url = new URL(config.get('redis', { infer: true }).url);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null as null,
  };
}

/**
 * The Living Notification Engine. ONE engine, many channels. Global so any
 * business module injects NotificationDispatcher without importing this. Owns the
 * single shared notification queue + DLQ, the channel router, delivery tracking,
 * metrics, history, template engine and the retry worker. Channels (Email —
 * reused verbatim; WhatsApp — new) plug in via NOTIFICATION_CHANNEL_LIST.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({ connection: bullConnection(config) }),
    }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }, { name: NOTIFICATION_DLQ }),
  ],
  controllers: [NotificationController, MetaWebhookController],
  providers: [
    // Channels + their reused provider stacks
    EmailProviderRegistry,
    EmailChannel,
    WhatsAppChannel,
    // The single place enumerating channels (the channel factory)
    {
      provide: NOTIFICATION_CHANNEL_LIST,
      inject: [EmailChannel, WhatsAppChannel],
      useFactory: (email: EmailChannel, whatsapp: WhatsAppChannel) => [email, whatsapp],
    },
    // Channel-agnostic core
    ChannelRouter,
    EmailTemplateEngine,
    DeliveryTracker,
    NotificationMetrics,
    NotificationHistory,
    RecipientResolver,
    NotificationDispatcher,
    NotificationProcessor,
    // Inbound
    MetaWebhookService,
  ],
  exports: [NotificationDispatcher, EmailTemplateEngine, RecipientResolver, ChannelRouter],
})
export class NotificationModule {}
