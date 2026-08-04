import { Injectable } from '@nestjs/common';
import { GateEntryStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';

export interface GateStatistics {
  today: { total: number; pending: number; approved: number; rejected: number; completed: number };
  pendingApprovals: number;
  /** Mean seconds from notification to decision over the window (null if none). */
  averageApprovalSeconds: number | null;
  rejectedInWindow: number;
  topVendors: { vendorName: string; count: number }[];
  /** Deliveries per hour of day (0–23), summed over the window. */
  peakHours: { hour: number; count: number }[];
  /** Per-day totals for the window, oldest first. */
  trend: { date: string; count: number }[];
  windowDays: number;
}

/**
 * Read-only reporting over the gate register.
 *
 * Aggregates are computed in Postgres rather than in Node: a busy community
 * produces thousands of entries a month, and pulling them all back to count
 * them would be the obvious way to make this endpoint the slowest in the app.
 */
@Injectable()
export class GateAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
  ) {}

  async statistics(communityId: string, days = 30): Promise<GateStatistics> {
    await this.access.assert(communityId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const windowStart = new Date(startOfToday);
    windowStart.setDate(windowStart.getDate() - (days - 1));

    const [todayRows, pendingApprovals, approval, rejectedInWindow, topVendors, peakHours, trend] =
      await Promise.all([
        this.prisma.gateEntry.groupBy({
          by: ['status'],
          where: { communityId, deletedAt: null, createdAt: { gte: startOfToday } },
          _count: { _all: true },
        }),
        this.prisma.gateEntry.count({
          where: {
            communityId,
            deletedAt: null,
            status: { in: [GateEntryStatus.CREATED, GateEntryStatus.NOTIFIED] },
          },
        }),
        this.averageApprovalSeconds(communityId, windowStart),
        this.prisma.gateEntry.count({
          where: {
            communityId,
            deletedAt: null,
            status: GateEntryStatus.REJECTED,
            createdAt: { gte: windowStart },
          },
        }),
        this.topVendors(communityId, windowStart),
        this.peakHours(communityId, windowStart),
        this.trend(communityId, windowStart),
      ]);

    const byStatus = new Map(todayRows.map((r) => [r.status, r._count._all]));
    const countOf = (...statuses: GateEntryStatus[]) =>
      statuses.reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0);

    return {
      today: {
        total: todayRows.reduce((sum, r) => sum + r._count._all, 0),
        pending: countOf(GateEntryStatus.CREATED, GateEntryStatus.NOTIFIED),
        approved: countOf(GateEntryStatus.APPROVED),
        rejected: countOf(GateEntryStatus.REJECTED),
        completed: countOf(GateEntryStatus.COMPLETED),
      },
      pendingApprovals,
      averageApprovalSeconds: approval,
      rejectedInWindow,
      topVendors,
      peakHours,
      trend,
      windowDays: days,
    };
  }

  /**
   * Mean time from the resident being notified to them deciding. Entries with
   * no `notifiedAt` are excluded — a decision made before the notification job
   * drained would otherwise contribute a nonsense (negative) interval.
   */
  private async averageApprovalSeconds(
    communityId: string,
    since: Date,
  ): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ avg: number | null }[]>(Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM ("decidedAt" - "notifiedAt")))::float AS avg
      FROM "gate_entries"
      WHERE "communityId" = ${communityId}
        AND "deletedAt" IS NULL
        AND "notifiedAt" IS NOT NULL
        AND "decidedAt" IS NOT NULL
        AND "decidedAt" >= "notifiedAt"
        AND "createdAt" >= ${since}
    `);
    const avg = rows[0]?.avg;
    return avg === null || avg === undefined ? null : Math.round(avg);
  }

  private async topVendors(communityId: string, since: Date) {
    const rows = await this.prisma.gateEntry.groupBy({
      by: ['vendorName'],
      where: {
        communityId,
        deletedAt: null,
        createdAt: { gte: since },
        vendorName: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { vendorName: 'desc' } },
      take: 8,
    });
    return rows.map((r) => ({ vendorName: r.vendorName!, count: r._count._all }));
  }

  private async peakHours(communityId: string, since: Date) {
    const rows = await this.prisma.$queryRaw<{ hour: number; count: bigint }[]>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
      FROM "gate_entries"
      WHERE "communityId" = ${communityId}
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `);
    const byHour = new Map(rows.map((r) => [r.hour, Number(r.count)]));
    // Emit all 24 buckets so the chart never has to guess at gaps.
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: byHour.get(hour) ?? 0 }));
  }

  private async trend(communityId: string, since: Date) {
    const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "gate_entries"
      WHERE "communityId" = ${communityId}
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }
}
