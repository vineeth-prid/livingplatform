import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';

/**
 * Read-only summary counts for the ticket dashboard. Group-by aggregates only —
 * no charts, no frontend. Everything is scoped to one community.
 */
@Injectable()
export class TicketDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
  ) {}

  async summary(communityId: string) {
    await this.access.assert(communityId);
    const base: Prisma.TicketWhereInput = { communityId, deletedAt: null };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [byStatus, byPriority, byCategoryRaw, resolvedToday, closedToday, criticalOpen] =
      await Promise.all([
        this.prisma.ticket.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
        this.prisma.ticket.groupBy({ by: ['priority'], where: base, _count: { _all: true } }),
        this.prisma.ticket.groupBy({ by: ['categoryId'], where: base, _count: { _all: true } }),
        this.prisma.ticket.count({ where: { ...base, resolvedDate: { gte: startOfToday } } }),
        this.prisma.ticket.count({ where: { ...base, closedDate: { gte: startOfToday } } }),
        this.prisma.ticket.count({
          where: {
            ...base,
            priority: 'CRITICAL',
            status: { notIn: [TicketStatus.CLOSED, TicketStatus.CANCELLED] },
          },
        }),
      ]);

    const statusCount = (s: TicketStatus) =>
      byStatus.find((r) => r.status === s)?._count._all ?? 0;

    // Resolve category names for the by-category breakdown.
    const categories = await this.prisma.ticketCategory.findMany({
      where: { id: { in: byCategoryRaw.map((r) => r.categoryId) } },
      select: { id: true, name: true, color: true },
    });
    const nameById = new Map(categories.map((c) => [c.id, c]));

    return {
      open: statusCount(TicketStatus.OPEN),
      assigned: statusCount(TicketStatus.ASSIGNED),
      inProgress: statusCount(TicketStatus.IN_PROGRESS),
      onHold: statusCount(TicketStatus.ON_HOLD),
      resolvedToday,
      closedToday,
      criticalOpen,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
      byCategory: byCategoryRaw.map((r) => ({
        categoryId: r.categoryId,
        name: nameById.get(r.categoryId)?.name ?? null,
        color: nameById.get(r.categoryId)?.color ?? null,
        count: r._count._all,
      })),
    };
  }
}
