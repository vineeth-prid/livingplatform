import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/configuration';
import { DeliveryTracker } from '../core/delivery-tracker';

interface WaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errors?: { title?: string; message?: string }[];
}
interface WaInboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}
interface WaWebhookPayload {
  object?: string;
  entry?: {
    changes?: {
      value?: { statuses?: WaStatus[]; messages?: WaInboundMessage[] };
    }[];
  }[];
}

/**
 * Processes Meta WhatsApp webhook callbacks: subscription verification, HMAC
 * signature validation, delivery/read/failed status updates (matched to
 * NotificationDelivery by provider message id), and inbound messages. Built so
 * future incoming channels plug into the same shape.
 */
@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);
  private readonly verifyToken: string;
  private readonly appSecret: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly tracking: DeliveryTracker,
    config: ConfigService<AppConfig, true>,
  ) {
    const meta = config.get('whatsapp', { infer: true }).meta;
    this.verifyToken = meta.verifyToken;
    this.appSecret = meta.appSecret;
    this.isProduction = config.get('env', { infer: true }) === 'production';
  }

  /** GET hub-verification: echo the challenge when the verify token matches.
   *  Fails closed if no verify token is configured, and compares in constant time. */
  verifyChallenge(mode?: string, token?: string, challenge?: string): string | null {
    if (mode !== 'subscribe' || !token || !this.verifyToken || !safeStrEqual(token, this.verifyToken)) {
      this.logger.warn('WhatsApp webhook verification failed (bad mode/token or verify token unset)');
      return null;
    }
    return challenge ?? '';
  }

  /** Validate the X-Hub-Signature-256 HMAC over the raw request body.
   *  Fails CLOSED in production when WHATSAPP_APP_SECRET is unset — an unsigned
   *  webhook is the only unauthenticated write path into notification state. */
  verifySignature(rawBody: string, signatureHeader?: string): boolean {
    if (!this.appSecret) {
      if (this.isProduction) {
        this.logger.error('WHATSAPP_APP_SECRET not set in production — rejecting unsigned webhook');
        return false;
      }
      this.logger.warn('WHATSAPP_APP_SECRET not set — webhook signature not verified (dev only)');
      return true;
    }
    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', this.appSecret).update(rawBody, 'utf8').digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Process a verified webhook payload (statuses + inbound messages). */
  async process(payload: WaWebhookPayload): Promise<{ statuses: number; messages: number }> {
    let statuses = 0;
    let messages = 0;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) {
          await this.applyStatus(s);
          statuses++;
        }
        for (const m of change.value?.messages ?? []) {
          // Do NOT log message bodies — they are recipient PII. Metadata only.
          this.logger.log({ event: 'whatsapp-inbound', from: m.from, id: m.id, type: m.type });
          messages++;
        }
      }
    }
    return { statuses, messages };
  }

  private async applyStatus(s: WaStatus): Promise<void> {
    switch (s.status) {
      case 'delivered':
        await this.tracking.markDelivered(s.id);
        break;
      case 'read':
        await this.tracking.markRead(s.id);
        break;
      case 'failed':
        await this.tracking.markProviderFailed(s.id, s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? 'WhatsApp delivery failed');
        break;
      // 'sent' is already reflected when we transmitted.
    }
  }
}

/** Constant-time string equality (avoids timing side-channels on the verify token). */
function safeStrEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
