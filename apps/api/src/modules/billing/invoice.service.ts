import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingCycle,
  InvoiceStatus,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  type MaintenanceInvoice,
} from '@prisma/client';

import { resolveSort } from '../../common/dto/list-query.dto';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { AppConfig } from '../../config/configuration';
import { myResidentIds } from '../community-ops/resident-access';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  amountFor,
  chargeInForce,
  daysOverdue,
  dueDateFor,
  invoiceNumber,
  lateFeeFor,
  periodFor,
  receiptNumber,
  round2,
  type BillingPeriod,
} from './billing.math';
import type {
  CollectionSummaryQueryDto,
  GenerateInvoicesDto,
  QueryInvoiceDto,
  RecordOfflinePaymentDto,
  UpdateInvoiceDto,
} from './dto/billing.dto';

const SORTABLE = ['dueDate', 'issueDate', 'totalAmount', 'status', 'createdAt'] as const;

export interface InvoiceView {
  id: string;
  communityId: string;
  unitId: string;
  unitNumber: string | null;
  propertyType: string | null;
  residentId: string | null;
  residentName: string | null;
  invoiceNumber: string;
  cycle: BillingCycle;
  periodStart: Date;
  periodEnd: Date;
  issueDate: Date;
  dueDate: Date;
  baseAmount: number;
  lateFee: number;
  adjustment: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  daysOverdue: number;
  paidAt: Date | null;
  notes: string | null;
}

export interface GenerationResult {
  cycle: BillingCycle;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  created: number;
  skipped: number;
  unpriced: number;
  totalBilled: number;
  dryRun: boolean;
  /** Property types with units but no rate card in force — the actionable gap. */
  missingRates: string[];
}

/**
 * Maintenance billing (Feature 4).
 *
 * Generation is a pure function of the rate card plus the unit register, and is
 * idempotent on (unit, cycle, periodStart) — re-running a month never
 * double-bills. Late fees are recomputed lazily on read/refresh rather than by
 * a nightly job, so a bill is always correct as of *now*.
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ── Generation ─────────────────────────────────────────────────────────────

  async generate(
    communityId: string,
    dto: GenerateInvoicesDto,
    actor: AuthenticatedUser,
  ): Promise<GenerationResult> {
    await this.access.assert(communityId);
    const billing = this.config.get('payments', { infer: true });
    const period = periodFor(dto.cycle, dto.periodDate ? new Date(dto.periodDate) : new Date());
    const dueDate = dueDateFor(period, dto.dueDay ?? billing.defaultDueDay);

    const [units, charges, existing] = await Promise.all([
      this.prisma.unit.findMany({
        where: {
          communityId,
          deletedAt: null,
          ...(dto.unitIds?.length ? { id: { in: dto.unitIds } } : {}),
        },
        select: {
          id: true,
          unitNumber: true,
          type: true,
          residentUnits: {
            where: { status: 'ACTIVE' },
            orderBy: { role: 'asc' },
            take: 1,
            select: { residentId: true },
          },
        },
      }),
      this.prisma.maintenanceCharge.findMany({ where: { communityId, deletedAt: null } }),
      this.prisma.maintenanceInvoice.findMany({
        where: { communityId, cycle: dto.cycle, periodStart: period.start },
        select: { unitId: true },
      }),
    ]);

    const alreadyBilled = new Set(existing.map((e) => e.unitId));
    const missingRates = new Set<string>();
    const rows: Prisma.MaintenanceInvoiceCreateManyInput[] = [];
    let skipped = 0;
    let unpriced = 0;
    let totalBilled = 0;

    let sequence = await this.nextSequence(communityId, period);
    for (const unit of units) {
      if (alreadyBilled.has(unit.id)) {
        skipped += 1;
        continue;
      }
      if (!unit.type) {
        unpriced += 1;
        continue;
      }
      const charge = chargeInForce(
        charges.filter((c) => c.propertyType === unit.type),
        period.start,
      );
      if (!charge) {
        unpriced += 1;
        missingRates.add(unit.type);
        continue;
      }
      const baseAmount = amountFor(
        {
          monthlyAmount: Number(charge.monthlyAmount),
          quarterlyAmount: charge.quarterlyAmount === null ? null : Number(charge.quarterlyAmount),
          yearlyAmount: charge.yearlyAmount === null ? null : Number(charge.yearlyAmount),
        },
        dto.cycle,
      );
      totalBilled = round2(totalBilled + baseAmount);
      rows.push({
        communityId,
        unitId: unit.id,
        residentId: unit.residentUnits[0]?.residentId ?? null,
        chargeId: charge.id,
        invoiceNumber: invoiceNumber(billing.invoicePrefix, period, sequence++),
        cycle: dto.cycle,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
        baseAmount,
        totalAmount: baseAmount,
        status: InvoiceStatus.ISSUED,
        createdById: actor.id,
        updatedById: actor.id,
      });
    }

    if (!dto.dryRun && rows.length > 0) {
      // skipDuplicates covers a concurrent run racing on the same period.
      await this.prisma.maintenanceInvoice.createMany({ data: rows, skipDuplicates: true });
      this.events.publish({
        name: DomainEventName.InvoiceGenerated,
        ...this.events.from(actor, communityId),
        entityId: communityId,
        data: { count: rows.length, amount: totalBilled },
      });
      this.logger.log(
        `Generated ${rows.length} ${dto.cycle} invoices for community=${communityId} period=${period.start.toISOString()}`,
      );
    }

    return {
      cycle: dto.cycle,
      periodStart: period.start,
      periodEnd: period.end,
      dueDate,
      created: rows.length,
      skipped,
      unpriced,
      totalBilled,
      dryRun: dto.dryRun ?? false,
      missingRates: [...missingRates].sort(),
    };
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findMany(
    communityId: string,
    query: QueryInvoiceDto,
    actor: AuthenticatedUser,
  ): Promise<Paginated<InvoiceView>> {
    await this.access.assert(communityId);
    const where: Prisma.MaintenanceInvoiceWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.cycle ? { cycle: query.cycle } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.outstandingOnly
        ? { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { unit: { unitNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
      ...(await this.residentScope(communityId, query.residentId, actor)),
    };

    const [rows, total] = await Promise.all([
      this.prisma.maintenanceInvoice.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'dueDate'),
        skip: query.skip,
        take: query.take,
        include: { unit: { select: { unitNumber: true, type: true } } },
      }),
      this.prisma.maintenanceInvoice.count({ where }),
    ]);
    const names = await this.residentNames(rows.map((r) => r.residentId));
    return paginate(
      rows.map((r) => toView(r, r.unit, names.get(r.residentId ?? '') ?? null)),
      total,
      query,
    );
  }

  async findOne(communityId: string, id: string, actor: AuthenticatedUser): Promise<InvoiceView> {
    await this.access.assert(communityId);
    const row = await this.prisma.maintenanceInvoice.findFirst({
      where: { id, communityId, deletedAt: null },
      include: { unit: { select: { unitNumber: true, type: true } } },
    });
    if (!row) throw new NotFoundException('Invoice not found');
    await this.assertVisible(communityId, row.residentId, actor);
    const names = await this.residentNames([row.residentId]);
    return toView(row, row.unit, names.get(row.residentId ?? '') ?? null);
  }

  /**
   * The resident's own dues view: current outstanding, next bill and history.
   * Drives the Resident PWA dashboard in one round trip.
   */
  async myDues(
    communityId: string,
    actor: AuthenticatedUser,
  ): Promise<{
    outstanding: number;
    currentDue: InvoiceView | null;
    nextDue: InvoiceView | null;
    overdueCount: number;
    recent: InvoiceView[];
  }> {
    await this.access.assert(communityId);
    const residentIds = await myResidentIds(this.prisma, actor, communityId);
    if (residentIds.length === 0) {
      return { outstanding: 0, currentDue: null, nextDue: null, overdueCount: 0, recent: [] };
    }
    const rows = await this.prisma.maintenanceInvoice.findMany({
      where: { communityId, residentId: { in: residentIds }, deletedAt: null },
      orderBy: { dueDate: 'desc' },
      take: 24,
      include: { unit: { select: { unitNumber: true, type: true } } },
    });
    const views = rows.map((r) => toView(r, r.unit, null));
    const unpaid = views
      .filter((v) => v.balance > 0 && v.status !== InvoiceStatus.CANCELLED)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const now = Date.now();
    return {
      outstanding: round2(unpaid.reduce((sum, v) => sum + v.balance, 0)),
      currentDue: unpaid[0] ?? null,
      nextDue: unpaid.find((v) => v.dueDate.getTime() > now) ?? null,
      overdueCount: unpaid.filter((v) => v.daysOverdue > 0).length,
      recent: views.slice(0, 12),
    };
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async update(
    communityId: string,
    id: string,
    dto: UpdateInvoiceDto,
    actor: AuthenticatedUser,
  ): Promise<InvoiceView> {
    await this.access.assert(communityId);
    const row = await this.requireInvoice(communityId, id);
    if (row.status === InvoiceStatus.PAID) {
      throw new BadRequestException('A paid invoice cannot be modified');
    }
    const adjustment = dto.adjustment ?? Number(row.adjustment);
    const totalAmount = round2(Number(row.baseAmount) + Number(row.lateFee) + adjustment);
    if (totalAmount < 0) throw new BadRequestException('An adjustment cannot make the total negative');

    const updated = await this.prisma.maintenanceInvoice.update({
      where: { id },
      data: {
        adjustment,
        totalAmount,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        notes: dto.notes,
        status: statusFor({ ...row, totalAmount }, Number(row.paidAmount)),
        updatedById: actor.id,
      },
      include: { unit: { select: { unitNumber: true, type: true } } },
    });
    return toView(updated, updated.unit, null);
  }

  async cancel(
    communityId: string,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ id: string; cancelled: boolean }> {
    await this.access.assert(communityId);
    const row = await this.requireInvoice(communityId, id);
    if (Number(row.paidAmount) > 0) {
      throw new BadRequestException('An invoice with payments against it cannot be cancelled');
    }
    await this.prisma.maintenanceInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date(), updatedById: actor.id },
    });
    this.events.publish({
      name: DomainEventName.InvoiceCancelled,
      ...this.events.from(actor, communityId),
      entityId: id,
      data: { invoiceNumber: row.invoiceNumber },
    });
    return { id, cancelled: true };
  }

  /**
   * Record a payment collected outside the gateway (cash, cheque, NEFT). Writes
   * the same Payment row an online collection writes, so the transaction
   * history and the dashboard stay complete.
   */
  async recordOfflinePayment(
    communityId: string,
    id: string,
    dto: RecordOfflinePaymentDto,
    actor: AuthenticatedUser,
  ): Promise<InvoiceView> {
    await this.access.assert(communityId);
    const invoice = await this.requireInvoice(communityId, id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('This invoice is cancelled');
    }
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const paidAmount = round2(Number(invoice.paidAmount) + dto.amount);

    const sequence = await this.prisma.payment.count({ where: { communityId } });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          communityId,
          purpose: PaymentPurpose.MAINTENANCE,
          invoiceId: invoice.id,
          unitId: invoice.unitId,
          residentId: invoice.residentId,
          userId: actor.id,
          amount: dto.amount,
          currency: this.config.get('payments', { infer: true }).currency,
          status: PaymentStatus.PAID,
          gateway: 'offline',
          method: dto.method ?? 'cash',
          gatewayPaymentId: dto.reference ?? null,
          receiptNumber: receiptNumber(paidAt, sequence + 1),
          paidAt,
          createdById: actor.id,
        },
      });
      return tx.maintenanceInvoice.update({
        where: { id },
        data: {
          paidAmount,
          status: statusFor(invoice, paidAmount),
          paidAt: paidAmount >= Number(invoice.totalAmount) ? paidAt : null,
          updatedById: actor.id,
        },
        include: { unit: { select: { unitNumber: true, type: true } } },
      });
    });
    return toView(updated, updated.unit, null);
  }

  /**
   * Apply late fees and flip ISSUED → OVERDUE for everything past its grace
   * period. Called by the admin dashboard and the nightly sweep; idempotent.
   *
   * ponytail: row-at-a-time updates — O(overdue invoices) round trips, and it
   * runs on the dashboard's read path. Fine at a few hundred overdue bills per
   * community. If a community's overdue set grows past ~1k, move this to the
   * nightly sweep only and have the dashboard read the last-swept values.
   */
  async refreshOverdue(communityId: string): Promise<{ updated: number; lateFeesAdded: number }> {
    const asOf = new Date();
    const rows = await this.prisma.maintenanceInvoice.findMany({
      where: {
        communityId,
        deletedAt: null,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        dueDate: { lt: asOf },
      },
      include: { charge: true },
    });

    let updated = 0;
    let lateFeesAdded = 0;
    for (const row of rows) {
      const outstanding = round2(Number(row.totalAmount) - Number(row.paidAmount));
      if (outstanding <= 0) continue;
      const lateFee = row.charge
        ? lateFeeFor(
            {
              monthlyAmount: Number(row.charge.monthlyAmount),
              lateFeeAmount: Number(row.charge.lateFeeAmount),
              lateFeePercent: row.charge.lateFeePercent,
              gracePeriodDays: row.charge.gracePeriodDays,
            },
            { outstanding: Number(row.baseAmount), dueDate: row.dueDate, asOf },
          )
        : Number(row.lateFee);

      const totalAmount = round2(Number(row.baseAmount) + lateFee + Number(row.adjustment));
      const nextStatus = InvoiceStatus.OVERDUE;
      if (lateFee === Number(row.lateFee) && row.status === nextStatus) continue;

      await this.prisma.maintenanceInvoice.update({
        where: { id: row.id },
        data: { lateFee, totalAmount, status: nextStatus },
      });
      updated += 1;
      lateFeesAdded = round2(lateFeesAdded + (lateFee - Number(row.lateFee)));
    }
    return { updated, lateFeesAdded };
  }

  // ── Collection dashboard ───────────────────────────────────────────────────

  async collectionSummary(communityId: string, query: CollectionSummaryQueryDto) {
    await this.access.assert(communityId);
    await this.refreshOverdue(communityId);

    const months = query.months ?? 6;
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - (months - 1), 1);
    since.setUTCHours(0, 0, 0, 0);

    const [totals, byStatus, payments, unitCount] = await Promise.all([
      this.prisma.maintenanceInvoice.aggregate({
        where: { communityId, deletedAt: null, status: { not: InvoiceStatus.CANCELLED } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: { _all: true },
      }),
      this.prisma.maintenanceInvoice.groupBy({
        by: ['status'],
        where: { communityId, deletedAt: null },
        _count: { _all: true },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.payment.findMany({
        where: {
          communityId,
          purpose: PaymentPurpose.MAINTENANCE,
          status: PaymentStatus.PAID,
          paidAt: { gte: since },
          deletedAt: null,
        },
        select: { amount: true, paidAt: true },
      }),
      this.prisma.unit.count({ where: { communityId, deletedAt: null } }),
    ]);

    const billed = Number(totals._sum.totalAmount ?? 0);
    const collected = Number(totals._sum.paidAmount ?? 0);
    const outstanding = round2(billed - collected);

    // Month buckets, oldest first, zero-filled so the chart never has gaps.
    const trend = new Map<string, number>();
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - i, 1);
      trend.set(monthKey(d), 0);
    }
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = monthKey(p.paidAt);
      if (trend.has(key)) trend.set(key, round2(trend.get(key)! + Number(p.amount)));
    }

    return {
      billed: round2(billed),
      collected: round2(collected),
      outstanding,
      collectionRate: billed > 0 ? round2((collected / billed) * 100) : 0,
      invoiceCount: totals._count._all,
      unitCount,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        billed: round2(Number(s._sum.totalAmount ?? 0)),
        collected: round2(Number(s._sum.paidAmount ?? 0)),
      })),
      monthlyCollection: [...trend.entries()].map(([month, amount]) => ({ month, amount })),
    };
  }

  /** Per-unit payment status — the "Residents / Payment Status" admin table. */
  async paymentStatusByUnit(communityId: string, query: QueryInvoiceDto) {
    await this.access.assert(communityId);
    const where: Prisma.MaintenanceInvoiceWhereInput = {
      communityId,
      deletedAt: null,
      status: { not: InvoiceStatus.CANCELLED },
    };
    const grouped = await this.prisma.maintenanceInvoice.groupBy({
      by: ['unitId'],
      where,
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      skip: query.skip,
      take: query.take,
    });
    const units = await this.prisma.unit.findMany({
      where: { id: { in: grouped.map((g) => g.unitId) } },
      select: {
        id: true,
        unitNumber: true,
        type: true,
        residentUnits: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { resident: { select: { id: true, firstName: true, lastName: true, mobile: true } } },
        },
      },
    });
    const byId = new Map(units.map((u) => [u.id, u]));
    // ponytail: a second groupBy purely to count distinct units. Prisma has no
    // count-distinct on groupBy; swap for one $queryRaw if this page gets slow.
    const total = (await this.prisma.maintenanceInvoice.groupBy({ by: ['unitId'], where })).length;

    return paginate(
      grouped.map((g) => {
        const unit = byId.get(g.unitId);
        const resident = unit?.residentUnits[0]?.resident;
        const billed = round2(Number(g._sum.totalAmount ?? 0));
        const collected = round2(Number(g._sum.paidAmount ?? 0));
        return {
          unitId: g.unitId,
          unitNumber: unit?.unitNumber ?? null,
          propertyType: unit?.type ?? null,
          residentId: resident?.id ?? null,
          residentName: resident ? `${resident.firstName} ${resident.lastName}` : null,
          residentMobile: resident?.mobile ?? null,
          invoiceCount: g._count._all,
          billed,
          collected,
          outstanding: round2(billed - collected),
        };
      }),
      total,
      query,
    );
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Called by PaymentService once a gateway payment is confirmed. */
  async applyPayment(
    invoiceId: string,
    amount: number,
    paidAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const invoice = await tx.maintenanceInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;
    const paidAmount = round2(Number(invoice.paidAmount) + amount);
    await tx.maintenanceInvoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        status: statusFor(invoice, paidAmount),
        paidAt: paidAmount >= Number(invoice.totalAmount) ? paidAt : invoice.paidAt,
      },
    });
  }

  private async requireInvoice(communityId: string, id: string): Promise<MaintenanceInvoice> {
    const row = await this.prisma.maintenanceInvoice.findFirst({
      where: { id, communityId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Invoice not found');
    return row;
  }

  /** Residents see only their own invoices; managers see everything. */
  private async residentScope(
    communityId: string,
    requestedResidentId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<Prisma.MaintenanceInvoiceWhereInput> {
    if (actor.permissions.includes(PERMISSIONS.BILLING_DASHBOARD_READ)) {
      return requestedResidentId ? { residentId: requestedResidentId } : {};
    }
    const mine = await myResidentIds(this.prisma, actor, communityId);
    return { residentId: { in: mine.length ? mine : ['__none__'] } };
  }

  private async assertVisible(
    communityId: string,
    residentId: string | null,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.permissions.includes(PERMISSIONS.BILLING_DASHBOARD_READ)) return;
    const mine = await myResidentIds(this.prisma, actor, communityId);
    if (!residentId || !mine.includes(residentId)) {
      throw new ForbiddenException('You can only view your own invoices');
    }
  }

  private async residentNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const residents = await this.prisma.resident.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(residents.map((r) => [r.id, `${r.firstName} ${r.lastName}`]));
  }

  /** Next invoice sequence for a community — invoice numbers stay contiguous. */
  private async nextSequence(communityId: string, period: BillingPeriod): Promise<number> {
    const count = await this.prisma.maintenanceInvoice.count({
      where: { communityId, periodStart: period.start },
    });
    return count + 1;
  }
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

function toView(
  row: MaintenanceInvoice,
  unit: { unitNumber: string; type: string | null } | null,
  residentName: string | null,
): InvoiceView {
  const total = Number(row.totalAmount);
  const paid = Number(row.paidAmount);
  return {
    id: row.id,
    communityId: row.communityId,
    unitId: row.unitId,
    unitNumber: unit?.unitNumber ?? null,
    propertyType: unit?.type ?? null,
    residentId: row.residentId,
    residentName,
    invoiceNumber: row.invoiceNumber,
    cycle: row.cycle,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    baseAmount: Number(row.baseAmount),
    lateFee: Number(row.lateFee),
    adjustment: Number(row.adjustment),
    totalAmount: total,
    paidAmount: paid,
    balance: round2(total - paid),
    status: row.status,
    daysOverdue:
      row.status === InvoiceStatus.PAID || row.status === InvoiceStatus.CANCELLED
        ? 0
        : daysOverdue(row.dueDate, new Date()),
    paidAt: row.paidAt,
    notes: row.notes,
  };
}

function statusFor(
  invoice: { totalAmount: Prisma.Decimal | number; dueDate: Date; status: InvoiceStatus },
  paidAmount: number,
): InvoiceStatus {
  if (invoice.status === InvoiceStatus.CANCELLED) return InvoiceStatus.CANCELLED;
  const total = Number(invoice.totalAmount);
  if (paidAmount >= total) return InvoiceStatus.PAID;
  if (paidAmount > 0) return InvoiceStatus.PARTIALLY_PAID;
  return invoice.dueDate.getTime() < Date.now() ? InvoiceStatus.OVERDUE : InvoiceStatus.ISSUED;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
