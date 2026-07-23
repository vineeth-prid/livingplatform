import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EmailStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_QUEUE } from './email.constants';

export interface EmailStatistics {
  sent: number;
  failed: number;
  deadLettered: number;
  queued: number;
  processing: number;
  retrying: number;
  /** Live BullMQ queue counts. */
  queue: { waiting: number; active: number; delayed: number; failed: number; completed: number };
  averageDeliveryMs: number;
  providerLatencyMs: number;
  totalRetries: number;
  byProvider: { provider: string; sent: number; failed: number }[];
  /** Placeholders — wired when SES SNS bounce/complaint notifications land. */
  bounces: number;
  complaints: number;
  windowHours: number;
}

/**
 * Aggregated email metrics for Platform Admin, from EmailDelivery rows plus live
 * BullMQ queue counts. Bounce/complaint are placeholders until SES event
 * notifications (SNS) are wired — the fields exist so the UI is ready.
 */
@Injectable()
export class EmailMetricsService {
  private readonly logger = new Logger(EmailMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue,
  ) {}

  async statistics(windowHours = 24): Promise<EmailStatistics> {
    const since = new Date(Date.now() - windowHours * 3_600_000);
    const where = { createdAt: { gte: since } };

    const [byStatus, sentAgg, retryAgg, byProviderRows, queueCounts] = await Promise.all([
      this.prisma.emailDelivery.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.emailDelivery.aggregate({
        where: { ...where, status: { in: [EmailStatus.SENT, EmailStatus.DELIVERED] } },
        _avg: { durationMs: true },
      }),
      this.prisma.emailDelivery.aggregate({ where, _sum: { retryCount: true } }),
      this.prisma.emailDelivery.groupBy({ by: ['provider', 'status'], where, _count: { _all: true } }),
      this.queueCounts(),
    ]);

    const countFor = (s: EmailStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    const sent = countFor(EmailStatus.SENT) + countFor(EmailStatus.DELIVERED);
    const failed = countFor(EmailStatus.FAILED);
    const deadLettered = countFor(EmailStatus.DEAD_LETTER);

    const providerMap = new Map<string, { sent: number; failed: number }>();
    for (const r of byProviderRows) {
      const e = providerMap.get(r.provider) ?? { sent: 0, failed: 0 };
      if (r.status === EmailStatus.SENT || r.status === EmailStatus.DELIVERED) e.sent += r._count._all;
      if (r.status === EmailStatus.FAILED || r.status === EmailStatus.DEAD_LETTER) e.failed += r._count._all;
      providerMap.set(r.provider, e);
    }

    const avgMs = Math.round(sentAgg._avg.durationMs ?? 0);
    return {
      sent, failed, deadLettered,
      queued: countFor(EmailStatus.QUEUED),
      processing: countFor(EmailStatus.PROCESSING),
      retrying: countFor(EmailStatus.RETRYING),
      queue: queueCounts,
      averageDeliveryMs: avgMs,
      providerLatencyMs: avgMs,
      totalRetries: retryAgg._sum.retryCount ?? 0,
      byProvider: [...providerMap.entries()].map(([provider, v]) => ({ provider, ...v })),
      bounces: 0,
      complaints: 0,
      windowHours,
    };
  }

  private async queueCounts(): Promise<EmailStatistics['queue']> {
    try {
      const c = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
      return {
        waiting: c.waiting ?? 0, active: c.active ?? 0, delayed: c.delayed ?? 0,
        failed: c.failed ?? 0, completed: c.completed ?? 0,
      };
    } catch (e) {
      this.logger.warn(`Queue counts unavailable: ${(e as Error).message}`);
      return { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 };
    }
  }
}
