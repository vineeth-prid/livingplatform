import { Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommunityStatus, InvoiceStatus } from '@prisma/client';

import { NotificationRouterService } from '../notifications/core/notification-router.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityModulesService } from '../settings/community-modules.service';
import { InvoiceService } from './invoice.service';

/**
 * Nightly billing sweep across every active community:
 *   1. apply late fees and flip due invoices to OVERDUE
 *   2. emit the MAINTENANCE_DUE reminder for bills falling due soon
 *
 * Reminders go through the Notification Engine's event seam (a domain event the
 * NotificationRouter listens for) — this service never sends a message itself,
 * so it stays out of the notification abstraction entirely.
 *
 * **This class MUST resolve as a singleton.** `ScheduleModule` discovers
 * `@Cron` handlers by walking singleton instances; a request-scoped scheduler is
 * silently never registered — no error, no log, the sweep simply never runs.
 *
 * `InvoiceService` and `NotificationRouterService` are both request-scoped (they
 * reach `CommunityAccessService` → `TenantContextService`), so they are resolved
 * per run through ModuleRef with a synthetic system principal — the same
 * idiomatic pattern `MaintenanceGenerationService` uses to call the
 * request-scoped Work Order engine from its scheduler.
 *
 * Set BILLING_SWEEP_ENABLED=false to disable (same switch style as the
 * announcement sweep).
 */
@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: CommunityModulesService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * A DI context for this run. Cron executes outside any HTTP request, so the
   * request-scoped chain needs a context registered by hand; the sweep touches
   * no tenant-guarded method, so an empty principal is correct rather than a
   * forged one.
   */
  private async scoped(): Promise<{
    invoices: InvoiceService;
    notifications: NotificationRouterService;
  }> {
    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({}, contextId);
    const [invoices, notifications] = await Promise.all([
      this.moduleRef.resolve(InvoiceService, contextId, { strict: false }),
      this.moduleRef.resolve(NotificationRouterService, contextId, { strict: false }),
    ]);
    return { invoices, notifications };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'billing-overdue-sweep' })
  async scheduledSweep(): Promise<void> {
    if (process.env.BILLING_SWEEP_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const { notifications } = await this.scoped();
      const result = await this.sweep();
      // Reminders ride the Notification Engine's routing (per-community
      // channel preferences); this service never picks a channel itself.
      const reminded = await notifications.sendMaintenanceDue(await this.dueSoon());
      if (result.invoicesUpdated > 0 || reminded > 0) {
        this.logger.log(
          `Billing sweep: ${result.invoicesUpdated} invoices updated across ${result.communities} communities, ${reminded} reminders queued`,
        );
      }
    } catch (err) {
      this.logger.error('Billing sweep failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  async sweep(): Promise<{ communities: number; invoicesUpdated: number }> {
    const { invoices } = await this.scoped();
    const communities = await this.billingCommunityIds();
    let invoicesUpdated = 0;
    for (const id of communities) {
      const { updated } = await invoices.refreshOverdue(id);
      invoicesUpdated += updated;
    }
    return { communities: communities.length, invoicesUpdated };
  }

  /**
   * Active communities that have maintenance billing switched ON. A community
   * that does not use Living for collection must never have late fees applied
   * or reminders sent, so the sweep filters here rather than per-invoice.
   */
  private async billingCommunityIds(): Promise<string[]> {
    const communities = await this.prisma.community.findMany({
      where: { deletedAt: null, status: CommunityStatus.ACTIVE },
      select: { id: true },
    });
    const enabled = await this.modules.maintenanceEnabledByCommunity(
      communities.map((c) => c.id),
    );
    return communities.filter((c) => enabled.get(c.id)).map((c) => c.id);
  }

  /**
   * Invoices due within `days` that are still unpaid — the reminder queue the
   * notification router drains. Exposed for tests and for a manual re-send.
   */
  async dueSoon(days = 3) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 86_400_000);
    return this.prisma.maintenanceInvoice.findMany({
      where: {
        deletedAt: null,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { gte: now, lte: until },
        residentId: { not: null },
      },
      select: {
        id: true,
        communityId: true,
        residentId: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
      },
      take: 1000,
    });
  }
}
