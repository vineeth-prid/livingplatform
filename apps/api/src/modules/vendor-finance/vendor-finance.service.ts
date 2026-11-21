import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, ServiceRequestStatus, VendorPayoutStatus, type PayoutFrequency } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import type {
  CancelPayoutDto,
  CreateCommissionConfigDto,
  MarkPayoutPaidDto,
  QueryPayoutsDto,
  QueryVendorFinanceDto,
  VendorInvoiceDto,
} from './dto/vendor-finance.dto';
import {
  commissionableAmount,
  commissionFor,
  dayIn,
  frequencyOf,
  periodOf,
  termsAt,
  type ConfigRow,
} from './vendor-finance.math';

const D = Prisma.Decimal;
const ZERO = new D(0);
const midday = (ymd: string) => new Date(`${ymd}T12:00:00.000Z`);
const srNo = (n: number) => `SRQ-${String(n).padStart(6, '0')}`;

/** One completed service request, as vendor earnings. */
export interface EarningRow {
  serviceRequestId: string;
  displayNumber: string;
  title: string;
  serviceId: string;
  serviceName: string;
  vendorId: string;
  vendorName: string;
  unitNumber: string | null;
  completedAt: Date;
  basis: 'PAID' | 'PACKAGE';
  serviceValue: number;
  commissionModel: string;
  commissionRate: number | null;
  commission: number;
  payable: number;
  /** UNSETTLED = not yet on a payout statement. */
  payoutStatus: 'UNSETTLED' | 'PENDING' | 'PAID';
  payoutId: string | null;
  payoutNumber: string | null;
  period: { start: string; end: string; frequency: PayoutFrequency };
}

/**
 * Vendor commission, payout statements and payout records for a community.
 *
 * Earnings are DERIVED from completed service requests (never stored twice):
 * a request is worth what the resident paid less refunds, or the catalogue
 * price for a package redemption (see commissionableAmount). The terms that
 * applied on the completion day set the commission. Once a request is on a
 * payout statement its line freezes those numbers, and the unique
 * serviceRequestId on the line means it can never be paid twice.
 *
 * Money only "moves" when an admin records a payout as paid — Living has no
 * automated disbursement. A PAID payout is immutable; a PENDING one can be
 * cancelled, which releases its requests for the next statement.
 */
@Injectable()
export class VendorFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ── Commission terms ───────────────────────────────────────────────────────

  async listConfigs(communityId: string, vendorId: string) {
    await this.access.assert(communityId);
    await this.vendorIn(communityId, vendorId);
    return this.prisma.vendorCommissionConfig.findMany({
      where: { communityId, vendorId },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Terms are never edited: a change is a new row effective from its own date. */
  async addConfig(communityId: string, vendorId: string, dto: CreateCommissionConfigDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    await this.vendorIn(communityId, vendorId);
    if (dto.model === 'PERCENTAGE' && (dto.rate == null || dto.rate <= 0)) {
      throw new BadRequestException('Enter the commission percentage');
    }
    if (dto.model === 'FIXED' && (dto.fixedAmount == null || dto.fixedAmount <= 0)) {
      throw new BadRequestException('Enter the fixed commission amount');
    }
    if (dto.serviceId) {
      const { tenantId } = await this.prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { tenantId: true } });
      const svc = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, OR: [{ tenantId }, { tenantId: null }] },
        select: { id: true },
      });
      if (!svc) throw new BadRequestException('That service is not offered in this community');
    }
    const row = await this.prisma.vendorCommissionConfig.create({
      data: {
        communityId,
        vendorId,
        serviceId: dto.serviceId ?? null,
        model: dto.model,
        rate: dto.model === 'PERCENTAGE' ? new D(dto.rate!) : null,
        fixedAmount: dto.model === 'FIXED' ? new D(dto.fixedAmount!) : null,
        payoutFrequency: dto.payoutFrequency,
        effectiveFrom: midday(dto.effectiveFrom),
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    await this.record(actor, communityId, 'vendor_commission.created', row.id, {
      vendorId, model: dto.model, rate: dto.rate ?? null, fixedAmount: dto.fixedAmount ?? null,
      payoutFrequency: dto.payoutFrequency, effectiveFrom: dto.effectiveFrom, serviceId: dto.serviceId ?? null,
    });
    return row;
  }

  async deactivateConfig(communityId: string, id: string, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const row = await this.prisma.vendorCommissionConfig.findFirst({ where: { id, communityId } });
    if (!row) throw new NotFoundException('Commission terms not found');
    const updated = await this.prisma.vendorCommissionConfig.update({
      where: { id },
      data: { isActive: false, updatedById: actor.id },
    });
    await this.record(actor, communityId, 'vendor_commission.deactivated', id, { vendorId: row.vendorId });
    return updated;
  }

  // ── Earnings ───────────────────────────────────────────────────────────────

  async transactions(communityId: string, q: QueryVendorFinanceDto) {
    await this.access.assert(communityId);
    return this.earnings(communityId, q);
  }

  async summary(communityId: string, vendorId?: string) {
    await this.access.assert(communityId);
    return this.summarise(communityId, vendorId);
  }

  // ── Payouts ────────────────────────────────────────────────────────────────

  /**
   * Group every vendor's UNSETTLED earnings in CLOSED periods (period already
   * ended) into PENDING payout statements — one per vendor per period. Safe to
   * run repeatedly: settled requests are skipped, and the unique line per
   * request makes a concurrent run fail instead of double-counting.
   */
  async generatePayouts(communityId: string, vendorId: string | undefined, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const tz = await this.timezone(communityId);
    const today = dayIn(new Date(), tz);
    const rows = (await this.earnings(communityId, { vendorId, payoutStatus: 'UNSETTLED' }))
      .filter((r) => r.period.end < today);

    const groups = new Map<string, EarningRow[]>();
    for (const r of rows) {
      const key = `${r.vendorId}|${r.period.start}|${r.period.end}|${r.period.frequency}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }

    const created: { id: string; number: string; vendorId: string; payable: number }[] = [];
    for (const [key, lines] of groups) {
      const [vId, start, end, frequency] = key.split('|') as [string, string, string, PayoutFrequency];
      const sum = (f: 'serviceValue' | 'commission' | 'payable') => lines.reduce((s, l) => s.add(l[f]), ZERO);
      try {
        const payout = await this.prisma.$transaction(async (tx) => {
          const count = await tx.vendorPayout.count({ where: { communityId } });
          const number = `VPO-${end.slice(0, 7).replace('-', '')}-${String(count + 1).padStart(6, '0')}`;
          return tx.vendorPayout.create({
            data: {
              communityId,
              vendorId: vId,
              number,
              frequency,
              periodStart: midday(start),
              periodEnd: midday(end),
              serviceValue: sum('serviceValue'),
              commission: sum('commission'),
              payable: sum('payable'),
              createdById: actor.id,
              updatedById: actor.id,
              lines: {
                create: lines.map((l) => ({
                  serviceRequestId: l.serviceRequestId,
                  completedAt: l.completedAt,
                  basis: l.basis,
                  serviceValue: new D(l.serviceValue),
                  commissionModel: l.commissionModel as never,
                  commissionRate: l.commissionRate == null ? null : new D(l.commissionRate),
                  commission: new D(l.commission),
                  payable: new D(l.payable),
                })),
              },
            },
          });
        });
        created.push({ id: payout.id, number: payout.number, vendorId: vId, payable: Number(payout.payable) });
        await this.record(actor, communityId, 'vendor_payout.generated', payout.id, {
          vendorId: vId, number: payout.number, periodStart: start, periodEnd: end, lines: lines.length,
          payable: Number(payout.payable),
        });
      } catch (err) {
        // Another run took these requests first — leave them to it.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    return { created: created.length, payouts: created };
  }

  async listPayouts(communityId: string, q: QueryPayoutsDto, vendorId?: string) {
    await this.access.assert(communityId);
    const rows = await this.prisma.vendorPayout.findMany({
      where: {
        communityId,
        vendorId: vendorId ?? q.vendorId,
        status: q.status,
        frequency: q.frequency,
        periodEnd: q.from ? { gte: midday(q.from) } : undefined,
        periodStart: q.to ? { lte: midday(q.to) } : undefined,
      },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      include: { vendor: { select: { id: true, name: true, companyName: true } }, _count: { select: { lines: true } } },
      take: 500,
    });
    return rows.map(({ _count, ...p }) => ({ ...this.money(p), lineCount: _count.lines }));
  }

  async getPayout(communityId: string, id: string, vendorId?: string) {
    await this.access.assert(communityId);
    const p = await this.prisma.vendorPayout.findFirst({
      where: { id, communityId, ...(vendorId ? { vendorId } : {}) },
      include: {
        vendor: { select: { id: true, name: true, companyName: true, phone: true, email: true, addressLine: true, city: true } },
        lines: {
          orderBy: { completedAt: 'asc' },
          include: {
            serviceRequest: {
              select: { number: true, title: true, unit: { select: { unitNumber: true } }, service: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Payout not found');
    const [community, paidBy] = await Promise.all([
      this.prisma.community.findUnique({
        where: { id: communityId },
        select: { name: true, addressLine1: true, city: true, state: true, pincode: true, contactEmail: true, contactPhone: true, logoKey: true },
      }),
      p.paidById ? this.prisma.user.findUnique({ where: { id: p.paidById }, select: { firstName: true, lastName: true } }) : null,
    ]);
    const { logoKey, ...c } = community!;
    return {
      ...this.money(p),
      paidByName: paidBy ? [paidBy.firstName, paidBy.lastName].filter(Boolean).join(' ') : null,
      community: { ...c, logoUrl: await this.storage.signedUrl(logoKey) },
      lines: p.lines.map((l) => ({
        id: l.id,
        serviceRequestId: l.serviceRequestId,
        displayNumber: srNo(l.serviceRequest.number),
        title: l.serviceRequest.title,
        serviceName: l.serviceRequest.service.name,
        unitNumber: l.serviceRequest.unit?.unitNumber ?? null,
        completedAt: l.completedAt,
        basis: l.basis,
        serviceValue: Number(l.serviceValue),
        commissionModel: l.commissionModel,
        commissionRate: l.commissionRate == null ? null : Number(l.commissionRate),
        commission: Number(l.commission),
        payable: Number(l.payable),
      })),
    };
  }

  /**
   * Record that the payout was transferred. Exactly the payable amount, once:
   * the status flip is a compare-and-set on PENDING inside a transaction, so a
   * double click or two admins at once cannot record it twice.
   */
  async markPaid(communityId: string, id: string, dto: MarkPayoutPaidDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const payout = await this.prisma.vendorPayout.findFirst({ where: { id, communityId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== VendorPayoutStatus.PENDING) {
      throw new ConflictException(`This payout is already ${payout.status.toLowerCase()}`);
    }
    const amount = new D(dto.amount);
    if (!amount.eq(payout.payable)) {
      throw new BadRequestException(`The amount must be the payout's payable amount (₹${payout.payable.toFixed(2)})`);
    }
    const paidAt = new Date(dto.paidAt);
    if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86_400_000) {
      throw new BadRequestException('Enter the date the payment was made');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.vendorPayout.updateMany({
        where: { id, communityId, status: VendorPayoutStatus.PENDING },
        data: {
          status: VendorPayoutStatus.PAID,
          paidAmount: amount,
          paidAt,
          paymentReference: dto.reference.trim(),
          paymentMethod: dto.method?.trim() || null,
          notes: dto.notes?.trim() || null,
          paidById: actor.id,
          updatedById: actor.id,
        },
      });
      if (flipped.count !== 1) throw new ConflictException('This payout was just updated by someone else');
      return tx.vendorPayout.findUniqueOrThrow({ where: { id } });
    });
    await this.record(actor, communityId, 'vendor_payout.paid', id, {
      number: payout.number, vendorId: payout.vendorId, amount: dto.amount, reference: dto.reference, paidAt: dto.paidAt,
    });
    return this.money(result);
  }

  /** Cancel a PENDING statement (e.g. generated too early); its requests go back to unsettled. */
  async cancelPayout(communityId: string, id: string, dto: CancelPayoutDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const payout = await this.prisma.vendorPayout.findFirst({ where: { id, communityId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== VendorPayoutStatus.PENDING) {
      throw new ConflictException('Only a pending payout can be cancelled — a paid payout is final');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.vendorPayout.updateMany({
        where: { id, status: VendorPayoutStatus.PENDING },
        data: { status: VendorPayoutStatus.CANCELLED, cancelledAt: new Date(), cancelReason: dto.reason.trim(), updatedById: actor.id },
      });
      if (flipped.count !== 1) throw new ConflictException('This payout was just updated by someone else');
      await tx.vendorPayoutLine.deleteMany({ where: { payoutId: id } });
      return tx.vendorPayout.findUniqueOrThrow({ where: { id } });
    });
    await this.record(actor, communityId, 'vendor_payout.cancelled', id, { number: payout.number, reason: dto.reason });
    return this.money(result);
  }

  async invoiceUploadUrl(communityId: string, id: string, fileName: string, contentType?: string) {
    await this.access.assert(communityId);
    await this.requirePayout(communityId, id);
    const key = this.storage.buildKey(`vendor-invoices/${communityId}/${id}`, fileName);
    const signed = await this.storage.signUpload(key, contentType ? { contentType } : undefined);
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  /** Record the vendor's own invoice against a statement (a document, not a money change). */
  async setInvoice(communityId: string, id: string, dto: VendorInvoiceDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const payout = await this.requirePayout(communityId, id);
    if (payout.status === VendorPayoutStatus.CANCELLED) throw new ConflictException('This payout was cancelled');
    await this.storage.assertOwnedKey(dto.fileKey, `vendor-invoices/${communityId}/${id}`, payout.vendorInvoiceKey);
    const updated = await this.prisma.vendorPayout.update({
      where: { id },
      data: { vendorInvoiceNumber: dto.invoiceNumber.trim(), vendorInvoiceKey: dto.fileKey ?? payout.vendorInvoiceKey, updatedById: actor.id },
    });
    await this.record(actor, communityId, 'vendor_payout.invoice_recorded', id, { invoiceNumber: dto.invoiceNumber });
    return this.money(updated);
  }

  async invoiceDownload(communityId: string, id: string, vendorId?: string) {
    await this.access.assert(communityId);
    const payout = await this.requirePayout(communityId, id, vendorId);
    if (!payout.vendorInvoiceKey) throw new NotFoundException('No invoice file recorded for this payout');
    return { url: await this.storage.signedUrl(payout.vendorInvoiceKey) };
  }

  // ── Vendor self-service ────────────────────────────────────────────────────

  /** The vendor record behind the signed-in user; 403 for anyone else. */
  async myVendorId(communityId: string, actor: AuthenticatedUser): Promise<string> {
    await this.access.assert(communityId);
    const vendor = await this.prisma.vendor.findFirst({
      where: { userId: actor.id, deletedAt: null },
      select: { id: true, communityIds: true },
    });
    if (!vendor) throw new ForbiddenException('Only vendors have earnings');
    return vendor.id;
  }

  async myOverview(communityId: string, actor: AuthenticatedUser) {
    const vendorId = await this.myVendorId(communityId, actor);
    const [summary, transactions, payouts] = await Promise.all([
      this.summarise(communityId, vendorId),
      this.earnings(communityId, { vendorId }),
      this.listPayouts(communityId, {}, vendorId),
    ]);
    // A vendor sees their own figures; resident names never leave the admin side.
    return { summary, transactions, payouts };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async earnings(communityId: string, q: QueryVendorFinanceDto): Promise<EarningRow[]> {
    const tz = await this.timezone(communityId);
    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        communityId,
        deletedAt: null,
        status: ServiceRequestStatus.COMPLETED,
        // ±1 day of slack here; the exact cut is by the community's calendar day below.
        completedDate: {
          not: null,
          ...(q.from ? { gte: new Date(midday(q.from).getTime() - 36 * 3_600_000) } : {}),
          ...(q.to ? { lte: new Date(midday(q.to).getTime() + 36 * 3_600_000) } : {}),
        },
        assignedVendorId: q.vendorId ? q.vendorId : { not: null },
        serviceId: q.serviceId,
      },
      select: {
        id: true, number: true, title: true, serviceId: true, quantity: true, completedDate: true,
        assignedVendorId: true, packagePurchaseId: true,
        service: { select: { name: true, basePrice: true } },
        variant: { select: { price: true } },
        unit: { select: { unitNumber: true } },
        vendorPayoutLine: { include: { payout: { select: { id: true, number: true, status: true, frequency: true, periodStart: true, periodEnd: true } } } },
      },
      orderBy: { completedDate: 'desc' },
      take: 5000,
    });
    if (requests.length === 0) return [];

    const vendorIds = [...new Set(requests.map((r) => r.assignedVendorId!))];
    const [payments, configs, vendors] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          communityId,
          serviceRequestId: { in: requests.map((r) => r.id) },
          status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
          deletedAt: null,
        },
        select: { serviceRequestId: true, amount: true, refundAmount: true, status: true },
      }),
      this.prisma.vendorCommissionConfig.findMany({ where: { communityId, vendorId: { in: vendorIds } } }),
      this.prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } }),
    ]);
    const paidBy = new Map<string, { paid: Prisma.Decimal; refund: Prisma.Decimal }>();
    for (const p of payments) {
      const cur = paidBy.get(p.serviceRequestId!) ?? { paid: ZERO, refund: ZERO };
      // A REFUNDED payment with no refundAmount recorded was refunded in full.
      const refund = p.refundAmount ?? (p.status === PaymentStatus.REFUNDED ? p.amount : ZERO);
      paidBy.set(p.serviceRequestId!, { paid: cur.paid.add(p.amount), refund: cur.refund.add(refund) });
    }
    const configsBy = new Map<string, ConfigRow[]>();
    for (const c of configs) configsBy.set(c.vendorId, [...(configsBy.get(c.vendorId) ?? []), c]);
    const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

    const rows: EarningRow[] = [];
    for (const r of requests) {
      const vId = r.assignedVendorId!;
      const line = r.vendorPayoutLine;
      const completedAt = r.completedDate!;
      const base = {
        serviceRequestId: r.id,
        displayNumber: srNo(r.number),
        title: r.title,
        serviceId: r.serviceId,
        serviceName: r.service.name,
        vendorId: vId,
        vendorName: vendorName.get(vId) ?? 'Vendor',
        unitNumber: r.unit?.unitNumber ?? null,
        completedAt,
      };
      if (line) {
        // On a statement: the frozen numbers, never a recalculation.
        rows.push({
          ...base,
          basis: line.basis as 'PAID' | 'PACKAGE',
          serviceValue: Number(line.serviceValue),
          commissionModel: line.commissionModel,
          commissionRate: line.commissionRate == null ? null : Number(line.commissionRate),
          commission: Number(line.commission),
          payable: Number(line.payable),
          payoutStatus: line.payout.status === VendorPayoutStatus.PAID ? 'PAID' : 'PENDING',
          payoutId: line.payout.id,
          payoutNumber: line.payout.number,
          period: {
            start: line.payout.periodStart.toISOString().slice(0, 10),
            end: line.payout.periodEnd.toISOString().slice(0, 10),
            frequency: line.payout.frequency,
          },
        });
        continue;
      }
      const money = paidBy.get(r.id);
      const catalogue = (r.variant?.price ?? r.service.basePrice).mul(r.quantity || 1);
      const value = commissionableAmount({
        paidAmount: money?.paid ?? null,
        refundAmount: money?.refund ?? null,
        isPackageRedemption: !!r.packagePurchaseId,
        cataloguePrice: catalogue,
      });
      if (!value) continue; // nothing collected (or fully refunded) → not vendor earnings
      const vendorConfigs = configsBy.get(vId) ?? [];
      const terms = termsAt(vendorConfigs, r.serviceId, completedAt);
      const { commission, payable } = commissionFor(value.amount, terms);
      const frequency = frequencyOf(vendorConfigs);
      rows.push({
        ...base,
        basis: value.basis,
        serviceValue: Number(value.amount),
        commissionModel: terms?.model ?? 'NONE',
        commissionRate: terms?.model === 'PERCENTAGE' && terms.rate ? Number(terms.rate) : null,
        commission: Number(commission),
        payable: Number(payable),
        payoutStatus: 'UNSETTLED',
        payoutId: null,
        payoutNumber: null,
        period: { ...periodOf(dayIn(completedAt, tz), frequency), frequency },
      });
    }
    return rows.filter((r) => {
      const day = dayIn(r.completedAt, tz);
      return (!q.from || day >= q.from) && (!q.to || day <= q.to)
        && (!q.payoutStatus || r.payoutStatus === q.payoutStatus)
        && (!q.frequency || r.period.frequency === q.frequency);
    });
  }

  private async summarise(communityId: string, vendorId?: string) {
    const [rows, payouts, configs, tz] = await Promise.all([
      this.earnings(communityId, { vendorId }),
      this.prisma.vendorPayout.findMany({
        where: { communityId, vendorId, status: { not: VendorPayoutStatus.CANCELLED } },
        select: { status: true, payable: true, paidAmount: true, vendorInvoiceNumber: true },
      }),
      vendorId ? this.prisma.vendorCommissionConfig.findMany({ where: { communityId, vendorId } }) : Promise.resolve([]),
      this.timezone(communityId),
    ]);
    const sum = (list: EarningRow[], f: 'serviceValue' | 'commission' | 'payable') =>
      Number(list.reduce((s, r) => s.add(r[f]), ZERO));
    const unsettled = rows.filter((r) => r.payoutStatus === 'UNSETTLED');
    const pendingPayouts = payouts.filter((p) => p.status === VendorPayoutStatus.PENDING);
    const paidPayouts = payouts.filter((p) => p.status === VendorPayoutStatus.PAID);
    const frequency = frequencyOf(configs as ConfigRow[]);
    return {
      totalServiceValue: sum(rows, 'serviceValue'),
      totalCommission: sum(rows, 'commission'),
      totalPayable: sum(rows, 'payable'),
      /** Earned but not yet paid: open statements plus work not yet on one. */
      pendingPayout: Number(pendingPayouts.reduce((s, p) => s.add(p.payable), ZERO)) + sum(unsettled, 'payable'),
      unsettledPayable: sum(unsettled, 'payable'),
      paidAmount: Number(paidPayouts.reduce((s, p) => s.add(p.paidAmount ?? 0), ZERO)),
      pendingPayoutCount: pendingPayouts.length,
      paidPayoutCount: paidPayouts.length,
      awaitingInvoiceCount: pendingPayouts.filter((p) => !p.vendorInvoiceNumber).length,
      payoutFrequency: vendorId ? frequency : null,
      nextPayoutPeriod: vendorId ? { ...periodOf(dayIn(new Date(), tz), frequency), frequency } : null,
    };
  }

  private async vendorIn(communityId: string, vendorId: string) {
    const community = await this.prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { tenantId: true } });
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, deletedAt: null, OR: [{ tenantId: community.tenantId }, { communityIds: { has: communityId } }] },
      select: { id: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found in this community');
  }

  private async requirePayout(communityId: string, id: string, vendorId?: string) {
    const payout = await this.prisma.vendorPayout.findFirst({ where: { id, communityId, ...(vendorId ? { vendorId } : {}) } });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  private async timezone(communityId: string): Promise<string> {
    const c = await this.prisma.community.findUnique({ where: { id: communityId }, select: { timezone: true } });
    return c?.timezone ?? 'Asia/Kolkata';
  }

  /** Decimal columns as numbers for the JSON API (the DB keeps exact decimals). */
  private money<T extends { serviceValue: Prisma.Decimal; commission: Prisma.Decimal; payable: Prisma.Decimal; paidAmount: Prisma.Decimal | null }>(p: T) {
    return {
      ...p,
      serviceValue: Number(p.serviceValue),
      commission: Number(p.commission),
      payable: Number(p.payable),
      paidAmount: p.paidAmount == null ? null : Number(p.paidAmount),
    };
  }

  private async record(actor: AuthenticatedUser, communityId: string, action: string, resourceId: string, metadata: Prisma.InputJsonValue) {
    await this.audit.record({
      action,
      resource: 'vendor-finance',
      resourceId,
      actorId: actor.id,
      actorEmail: actor.email,
      tenantId: actor.tenantId,
      communityId,
      metadata,
    });
  }
}
