import { Injectable } from '@nestjs/common';
import { EmailStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { EmailMessage } from './providers/email-provider.interface';

const asArray = (v?: string | string[]): string[] => (v ? (Array.isArray(v) ? v : [v]) : []);

export interface TrackContext {
  provider: string;
  maxAttempts: number;
  template?: string;
  locale?: string;
  tenantId?: string | null;
  communityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery tracking — one EmailDelivery row per email, updated as it moves
 * through the lifecycle (queued → processing → sent/failed → dead-letter).
 * Pure persistence; no send logic. Failures to write tracking never block a send.
 */
@Injectable()
export class EmailTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Record a queued email; returns the tracking id (used as delivery ref). */
  async createQueued(message: EmailMessage, ctx: TrackContext): Promise<string> {
    const row = await this.prisma.emailDelivery.create({
      data: {
        provider: ctx.provider,
        recipients: asArray(message.to),
        cc: asArray(message.cc),
        bcc: asArray(message.bcc),
        subject: message.subject,
        template: ctx.template,
        locale: ctx.locale,
        priority: message.priority,
        status: EmailStatus.QUEUED,
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
    return this.prisma.emailDelivery.update({ where: { id }, data: { queueJobId } }).catch(() => null);
  }

  markProcessing(id: string): Promise<unknown> {
    return this.prisma.emailDelivery
      .update({ where: { id }, data: { status: EmailStatus.PROCESSING, processingAt: new Date() } })
      .catch(() => null);
  }

  markSent(id: string, data: { providerMessageId: string | null; providerResponse?: unknown; durationMs: number; retryCount: number }): Promise<unknown> {
    return this.prisma.emailDelivery
      .update({
        where: { id },
        data: {
          status: EmailStatus.SENT,
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
    return this.prisma.emailDelivery
      .update({
        where: { id },
        data: {
          status: data.dead ? EmailStatus.DEAD_LETTER : EmailStatus.RETRYING,
          error: data.error,
          retryCount: data.retryCount,
          durationMs: data.durationMs,
          ...(data.dead ? { failedAt: new Date() } : {}),
        },
      })
      .catch(() => null);
  }

  /** Terminal failure without further retries (e.g. validation error). */
  markFailed(id: string, error: string): Promise<unknown> {
    return this.prisma.emailDelivery
      .update({ where: { id }, data: { status: EmailStatus.FAILED, failedAt: new Date(), error } })
      .catch(() => null);
  }

  get(id: string) {
    return this.prisma.emailDelivery.findUnique({ where: { id } });
  }
}
