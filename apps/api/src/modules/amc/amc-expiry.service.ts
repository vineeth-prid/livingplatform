import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AMCEventType, AMCStatus } from '@prisma/client';

import { DomainEventName, type AMCEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { AmcHistoryService } from './amc-history.service';
import { isRenewalDue } from './amc.util';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily status sweep: flips ACTIVE contracts past their end date to EXPIRED
 * (emitting AMCContractExpired), and ACTIVE contracts inside their per-row
 * renewal window to RENEWAL_PENDING (so the `renewalDue` filter is exact). The
 * only automatic status motion in the engine — no notifications, no scheduling.
 * Set AMC_EXPIRY_ENABLED=false to disable on an instance.
 */
@Injectable()
export class AmcExpiryService {
  private readonly logger = new Logger(AmcExpiryService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
    private readonly history: AmcHistoryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'amc-expiry' })
  async scheduledSweep(): Promise<void> {
    if (process.env.AMC_EXPIRY_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const { expired, renewalPending } = await this.sweep();
      if (expired || renewalPending) {
        this.logger.log(`AMC sweep: ${expired} expired, ${renewalPending} renewal-pending`);
      }
    } catch (err) {
      this.logger.error('AMC expiry sweep failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  /** Runs the sweep once. Idempotent — status flips are compare-and-swap. */
  async sweep(now = new Date()): Promise<{ expired: number; renewalPending: number }> {
    let expired = 0;
    let renewalPending = 0;

    const overdue = await this.prisma.aMCContract.findMany({
      where: { status: AMCStatus.ACTIVE, deletedAt: null, endDate: { lt: now } },
      take: 500,
    });
    for (const c of overdue) {
      const claim = await this.prisma.aMCContract.updateMany({
        where: { id: c.id, status: AMCStatus.ACTIVE },
        data: { status: AMCStatus.EXPIRED },
      });
      if (claim.count !== 1) continue;
      await this.history.record({ contractId: c.id, eventType: AMCEventType.EXPIRED, metadata: { endDate: c.endDate } });
      this.publishExpired(c);
      expired++;
    }

    // Renewal window is per-row; bound the scan, then apply isRenewalDue exactly.
    const upcoming = await this.prisma.aMCContract.findMany({
      where: { status: AMCStatus.ACTIVE, deletedAt: null, endDate: { gte: now, lte: new Date(now.getTime() + 366 * DAY_MS) } },
      take: 1000,
    });
    for (const c of upcoming) {
      if (!isRenewalDue(c, now)) continue;
      const claim = await this.prisma.aMCContract.updateMany({
        where: { id: c.id, status: AMCStatus.ACTIVE },
        data: { status: AMCStatus.RENEWAL_PENDING },
      });
      if (claim.count === 1) renewalPending++;
    }

    return { expired, renewalPending };
  }

  private publishExpired(contract: { id: string; tenantId: string; communityId: string; contractNumber: string; vendorId: string }): void {
    const event = {
      name: DomainEventName.AMCContractExpired,
      tenantId: contract.tenantId,
      communityId: contract.communityId,
      actorId: null,
      entityId: contract.id,
      data: { contractNumber: contract.contractNumber, vendorId: contract.vendorId, status: AMCStatus.EXPIRED },
    } satisfies Omit<AMCEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
