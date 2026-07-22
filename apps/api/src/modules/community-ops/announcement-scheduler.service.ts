import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnnouncementStatus } from '@prisma/client';

import { DomainEventName, type AnnouncementEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Hourly sweep that moves announcements through their scheduled lifecycle:
 * DRAFT with a reached publishAt → PUBLISHED, and PUBLISHED past expiresAt →
 * EXPIRED. Status flips are compare-and-swap (idempotent). Manual publish/expire
 * still work via the service. Set ANNOUNCEMENT_SWEEP_ENABLED=false to disable.
 */
@Injectable()
export class AnnouncementSchedulerService {
  private readonly logger = new Logger(AnnouncementSchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'announcement-lifecycle' })
  async scheduledSweep(): Promise<void> {
    if (process.env.ANNOUNCEMENT_SWEEP_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const { published, expired } = await this.sweep();
      if (published || expired) this.logger.log(`Announcements: ${published} published, ${expired} expired`);
    } catch (err) {
      this.logger.error('Announcement sweep failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  async sweep(now = new Date()): Promise<{ published: number; expired: number }> {
    let published = 0;
    let expired = 0;

    const toPublish = await this.prisma.announcement.findMany({
      where: { status: AnnouncementStatus.DRAFT, deletedAt: null, publishAt: { not: null, lte: now } },
      take: 500,
    });
    for (const a of toPublish) {
      const claim = await this.prisma.announcement.updateMany({
        where: { id: a.id, status: AnnouncementStatus.DRAFT },
        data: { status: AnnouncementStatus.PUBLISHED },
      });
      if (claim.count !== 1) continue;
      this.emit(DomainEventName.AnnouncementPublished, a);
      published++;
    }

    const toExpire = await this.prisma.announcement.findMany({
      where: { status: AnnouncementStatus.PUBLISHED, deletedAt: null, expiresAt: { not: null, lte: now } },
      take: 500,
    });
    for (const a of toExpire) {
      const claim = await this.prisma.announcement.updateMany({
        where: { id: a.id, status: AnnouncementStatus.PUBLISHED },
        data: { status: AnnouncementStatus.EXPIRED },
      });
      if (claim.count !== 1) continue;
      this.emit(DomainEventName.AnnouncementExpired, a);
      expired++;
    }

    return { published, expired };
  }

  private emit(
    name: AnnouncementEvent['name'],
    a: { id: string; communityId: string; tenantId: string; title: string; priority: string },
  ): void {
    const event = {
      name,
      tenantId: a.tenantId,
      communityId: a.communityId,
      actorId: null,
      entityId: a.id,
      data: { title: a.title, priority: a.priority },
    } satisfies Omit<AnnouncementEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
