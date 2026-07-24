import { Injectable } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../../common/dto/pagination.dto';

import { PrismaService } from '../../prisma/prisma.service';

export interface HistoryQuery {
  page?: number;
  limit?: number;
  channel?: string;
  status?: NotificationStatus;
  search?: string;
  /** Tenant scope. Platform-admin views omit it (see all); community views MUST
   *  pass it so a community only ever sees its own notification history. */
  communityId?: string;
}

/**
 * Channel-agnostic notification history/search over NotificationDelivery rows.
 * Powers the admin history + search views. Read-only.
 */
@Injectable()
export class NotificationHistory {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: HistoryQuery): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const where: Prisma.NotificationDeliveryWhereInput = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.communityId ? { communityId: query.communityId } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { recipients: { has: query.search } },
              { template: { contains: query.search, mode: 'insensitive' } },
              { providerMessageId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationDelivery.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);
    return paginate(items, total, { page, limit } as never);
  }

  get(id: string) {
    return this.prisma.notificationDelivery.findUnique({ where: { id } });
  }
}
