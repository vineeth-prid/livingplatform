import { createHmac } from 'node:crypto';

import { Body, Controller, Headers, HttpCode, Logger, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { safeEqual } from '../../../common/crypto/secret-cipher';
import { Public } from '../../../common/decorators/public.decorator';
import type { AppConfig } from '../../../config/configuration';
import { WhatsAppSessionService } from '../channels/whatsapp/whatsapp-session.service';
import { DeliveryTracker } from '../core/delivery-tracker';

/**
 * OpenWA gateway callbacks: `session.status` keeps the connection manager's
 * view live without waiting for the watchdog, and message acknowledgements feed
 * the shared delivery tracker (the same one the email and Meta channels use).
 *
 * Public — the gateway has no JWT. Authentication is the HMAC signature over
 * the raw body when OPENWA_WEBHOOK_SECRET is set. With no secret configured the
 * endpoint refuses everything rather than trusting unauthenticated callers.
 */
@SkipThrottle()
@ApiExcludeController()
@Controller('notifications/webhooks')
export class OpenWaWebhookController {
  private readonly logger = new Logger(OpenWaWebhookController.name);
  private readonly secret: string;

  constructor(
    private readonly sessions: WhatsAppSessionService,
    private readonly tracking: DeliveryTracker,
    config: ConfigService<AppConfig, true>,
  ) {
    this.secret = config.get('whatsapp', { infer: true }).openwa.webhookSecret;
  }

  @Public()
  @Post('openwa')
  @HttpCode(200)
  async receive(
    @Body() raw: unknown,
    @Headers('x-webhook-signature') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    const rawBody = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
    if (!this.verify(rawBody, signature ?? '')) {
      res.status(403).send('Invalid signature');
      return;
    }

    try {
      const payload = (typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {})) as OpenWaEvent;
      await this.process(payload);
    } catch (err) {
      // Already authenticated — swallow so the gateway does not retry forever.
      this.logger.warn(`OpenWA webhook processing failed: ${(err as Error).message}`);
    }
    res.status(200).json({ ok: true });
  }

  private async process(event: OpenWaEvent): Promise<void> {
    const name = event.event ?? event.type;
    const session = event.session ?? event.sessionId ?? '';
    const data = event.data ?? event.payload ?? {};

    if (name === 'session.status' && session) {
      await this.sessions.applyWebhookStatus(
        session,
        String(data.status ?? data.state ?? ''),
        typeof data.phoneNumber === 'string' ? data.phoneNumber : undefined,
      );
      return;
    }

    // Delivery acknowledgements — map the gateway's ack levels onto the shared
    // NotificationDelivery lifecycle so WhatsApp reads like every other channel.
    if (name === 'message.ack' || name === 'message.status') {
      const messageId = String(data.id ?? data.messageId ?? '');
      const ack = String(data.ack ?? data.status ?? '').toLowerCase();
      if (!messageId) return;
      if (['3', 'read', 'played'].includes(ack)) {
        await this.tracking.markRead(messageId);
      } else if (['2', 'delivered', 'device'].includes(ack)) {
        await this.tracking.markDelivered(messageId);
      } else if (['-1', 'error', 'failed'].includes(ack)) {
        await this.tracking.markProviderFailed(messageId, 'Gateway reported delivery failure');
      }
    }
  }

  private verify(rawBody: string, signature: string): boolean {
    if (!this.secret) {
      this.logger.warn('OPENWA_WEBHOOK_SECRET is not configured — rejecting webhook');
      return false;
    }
    if (!signature) return false;
    const provided = signature.replace(/^sha256=/i, '');
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    return safeEqual(expected, provided);
  }
}

interface OpenWaEvent {
  event?: string;
  type?: string;
  session?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}
