import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_QUEUE } from '../notification.constants';

export interface NotificationStatistics {
  channel: string | 'all';
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deadLettered: number;
  queued: number;
  processing: number;
  retrying: number;
  queue: { waiting: number; active: number; delayed: number; failed: number; completed: number };
  averageDeliveryMs: number;
  providerLatencyMs: number;
  totalRetries: number;
  byChannel: { channel: string; sent: number; failed: number; delivered: number }[];
  byProvider: { provider: string; sent: number; failed: number }[];
  bounces: number;
  complaints: number;
  windowHours: number;
}

/**
 * Aggregated metrics for Platform Admin, from NotificationDelivery rows plus live
 * BullMQ counts. Channel-agnostic — pass a channel to scope it, or omit for
 * platform-wide. (Generalized from the Email sprint's EmailMetricsService;
 * bounce/complaint remain placeholders until provider event webhooks populate
 * them.)
 */
@Injectable()
export class NotificationMetrics {
  private readonly logger = new Logger(NotificationMetrics.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  async statistics(windowHours = 24, channel?: string, communityId?: string): Promise<NotificationStatistics> {
    const since = new Date(Date.now() - windowHours * 3_600_000);
    // communityId scopes stats to one tenant; platform-admin omits it (see all).
    const where = { createdAt: { gte: since }, ...(channel ? { channel } : {}), ...(communityId ? { communityId } : {}) };

    const [byStatus, sentAgg, retryAgg, byChannelRows, byProviderRows, queueCounts] = await Promise.all([
      this.prisma.notificationDelivery.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.notificationDelivery.aggregate({
        where: { ...where, status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ] } },
        _avg: { durationMs: true },
      }),
      this.prisma.notificationDelivery.aggregate({ where, _sum: { retryCount: true } }),
      this.prisma.notificationDelivery.groupBy({ by: ['channel', 'status'], where, _count: { _all: true } }),
      this.prisma.notificationDelivery.groupBy({ by: ['provider', 'status'], where, _count: { _all: true } }),
      this.queueCounts(),
    ]);

    const SENT_LIKE: NotificationStatus[] = [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ];
    const DELIVERED_LIKE: NotificationStatus[] = [NotificationStatus.DELIVERED, NotificationStatus.READ];
    const FAILED_LIKE: NotificationStatus[] = [NotificationStatus.FAILED, NotificationStatus.DEAD_LETTER];

    const countFor = (s: NotificationStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    const sentLike = countFor(NotificationStatus.SENT) + countFor(NotificationStatus.DELIVERED) + countFor(NotificationStatus.READ);

    const chan = new Map<string, { sent: number; failed: number; delivered: number }>();
    for (const r of byChannelRows) {
      const e = chan.get(r.channel) ?? { sent: 0, failed: 0, delivered: 0 };
      if (SENT_LIKE.includes(r.status)) e.sent += r._count._all;
      if (DELIVERED_LIKE.includes(r.status)) e.delivered += r._count._all;
      if (FAILED_LIKE.includes(r.status)) e.failed += r._count._all;
      chan.set(r.channel, e);
    }

    const prov = new Map<string, { sent: number; failed: number }>();
    for (const r of byProviderRows) {
      const e = prov.get(r.provider) ?? { sent: 0, failed: 0 };
      if (SENT_LIKE.includes(r.status)) e.sent += r._count._all;
      if (FAILED_LIKE.includes(r.status)) e.failed += r._count._all;
      prov.set(r.provider, e);
    }

    const avgMs = Math.round(sentAgg._avg.durationMs ?? 0);
    return {
      channel: channel ?? 'all',
      sent: sentLike,
      delivered: countFor(NotificationStatus.DELIVERED) + countFor(NotificationStatus.READ),
      read: countFor(NotificationStatus.READ),
      failed: countFor(NotificationStatus.FAILED),
      deadLettered: countFor(NotificationStatus.DEAD_LETTER),
      queued: countFor(NotificationStatus.QUEUED),
      processing: countFor(NotificationStatus.PROCESSING),
      retrying: countFor(NotificationStatus.RETRYING),
      queue: queueCounts,
      averageDeliveryMs: avgMs,
      providerLatencyMs: avgMs,
      totalRetries: retryAgg._sum.retryCount ?? 0,
      byChannel: [...chan.entries()].map(([c, v]) => ({ channel: c, ...v })),
      byProvider: [...prov.entries()].map(([provider, v]) => ({ provider, ...v })),
      bounces: 0,
      complaints: 0,
      windowHours,
    };
  }

  private async queueCounts(): Promise<NotificationStatistics['queue']> {
    try {
      const c = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
      return { waiting: c.waiting ?? 0, active: c.active ?? 0, delayed: c.delayed ?? 0, failed: c.failed ?? 0, completed: c.completed ?? 0 };
    } catch (e) {
      this.logger.warn(`Queue counts unavailable: ${(e as Error).message}`);
      return { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 };
    }
  }
}
