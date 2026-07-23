import { Injectable } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { NotificationChannelName, NotificationMessage } from './notification-channel.interface';

const asArray = (v?: string | string[]): string[] => (v ? (Array.isArray(v) ? v : [v]) : []);

export interface TrackContext {
  channel: NotificationChannelName;
  provider: string;
  maxAttempts: number;
  subject?: string;
  template?: string;
  locale?: string;
  tenantId?: string | null;
  communityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Channel-agnostic delivery tracking — one NotificationDelivery row per
 * notification, updated through its lifecycle (queued → processing →
 * sent → delivered/read → failed → dead-letter). Pure persistence; shared by
 * every channel. Tracking writes never block a send (all update paths swallow).
 * (Generalized from the Email sprint's EmailTrackingService.)
 */
@Injectable()
export class DeliveryTracker {
  constructor(private readonly prisma: PrismaService) {}

  async createQueued(message: NotificationMessage, ctx: TrackContext): Promise<string> {
    const row = await this.prisma.notificationDelivery.create({
      data: {
        channel: ctx.channel,
        provider: ctx.provider,
        recipients: asArray(message.to),
        cc: asArray(message.cc),
        bcc: asArray(message.bcc),
        subject: ctx.subject ?? message.subject ?? '',
        template: ctx.template,
        locale: ctx.locale,
        priority: message.priority,
        status: NotificationStatus.QUEUED,
        maxAttempts: ctx.maxAttempts,
        tenantId: ctx.tenantId ?? null,
        communityId: ctx.communityId ?? null,
        metadata: ctx.metadata as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
    return row.id;
  }

  attachJob(id: string, queueJobId: string): Promise<unknown> {
    return this.prisma.notificationDelivery.update({ where: { id }, data: { queueJobId } }).catch(() => null);
  }

  markProcessing(id: string): Promise<unknown> {
    return this.prisma.notificationDelivery
      .update({ where: { id }, data: { status: NotificationStatus.PROCESSING, processingAt: new Date() } })
      .catch(() => null);
  }

  markSent(id: string, data: { providerMessageId: string | null; providerResponse?: unknown; durationMs: number; retryCount: number }): Promise<unknown> {
    return this.prisma.notificationDelivery
      .update({
        where: { id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          providerMessageId: data.providerMessageId,
          providerResponse: data.providerResponse as Prisma.InputJsonValue | undefined,
          durationMs: data.durationMs,
          retryCount: data.retryCount,
          error: null,
        },
      })
      .catch(() => null);
  }

  markAttemptFailed(id: string, data: { error: string; retryCount: number; durationMs: number; dead: boolean }): Promise<unknown> {
    return this.prisma.notificationDelivery
      .update({
        where: { id },
        data: {
          status: data.dead ? NotificationStatus.DEAD_LETTER : NotificationStatus.RETRYING,
          error: data.error,
          retryCount: data.retryCount,
          durationMs: data.durationMs,
          ...(data.dead ? { failedAt: new Date() } : {}),
        },
      })
      .catch(() => null);
  }

  markFailed(id: string, error: string): Promise<unknown> {
    return this.prisma.notificationDelivery
      .update({ where: { id }, data: { status: NotificationStatus.FAILED, failedAt: new Date(), error } })
      .catch(() => null);
  }

  // ── Provider callbacks (webhooks) — matched by provider message id ──

  private byProviderMessageId(providerMessageId: string) {
    return this.prisma.notificationDelivery.findFirst({
      where: { providerMessageId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  /** A delivery receipt from a provider webhook (e.g. WhatsApp/SES). */
  async markDelivered(providerMessageId: string): Promise<boolean> {
    const row = await this.byProviderMessageId(providerMessageId);
    if (!row) return false;
    await this.prisma.notificationDelivery
      .update({ where: { id: row.id }, data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() } })
      .catch(() => null);
    return true;
  }

  /** A read receipt (e.g. WhatsApp blue ticks). */
  async markRead(providerMessageId: string): Promise<boolean> {
    const row = await this.byProviderMessageId(providerMessageId);
    if (!row) return false;
    await this.prisma.notificationDelivery
      .update({ where: { id: row.id }, data: { status: NotificationStatus.READ, readAt: new Date() } })
      .catch(() => null);
    return true;
  }

  /** A provider-reported failure/bounce for an already-sent message. */
  async markProviderFailed(providerMessageId: string, error: string): Promise<boolean> {
    const row = await this.byProviderMessageId(providerMessageId);
    if (!row) return false;
    await this.prisma.notificationDelivery
      .update({ where: { id: row.id }, data: { status: NotificationStatus.FAILED, failedAt: new Date(), error } })
      .catch(() => null);
    return true;
  }

  get(id: string) {
    return this.prisma.notificationDelivery.findUnique({ where: { id } });
  }
}
