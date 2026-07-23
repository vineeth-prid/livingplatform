import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { EMAIL_DLQ, EMAIL_QUEUE } from './email.constants';
import { EmailController } from './email.controller';
import { EmailMetricsService } from './email.metrics.service';
import { EmailProcessor } from './email.processor';
import { EmailProviderRegistry } from './email-provider.registry';
import { EmailService } from './email.service';
import { EmailTrackingService } from './email.tracking.service';
import { EmailTemplateEngine } from './templates/template.engine';

/** Parse REDIS_URL into a BullMQ connection (its own connection, not shared with
 *  the app RedisService — BullMQ needs maxRetriesPerRequest:null + blocking cmds). */
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
 * Notification Engine · Email Service. Global so any business module can inject
 * EmailService without importing this module. Owns the BullMQ email queue + its
 * dead-letter queue, the provider registry/factory, the template engine, delivery
 * tracking and metrics. The provider is chosen ONLY by configuration.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({ connection: bullConnection(config) }),
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: EMAIL_DLQ }),
  ],
  controllers: [EmailController],
  providers: [
    EmailProviderRegistry,
    EmailTemplateEngine,
    EmailTrackingService,
    EmailMetricsService,
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService, EmailTemplateEngine],
})
export class EmailModule {}
