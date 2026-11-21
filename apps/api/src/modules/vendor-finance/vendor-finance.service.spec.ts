import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { VendorFinanceService } from './vendor-finance.service';

const D = (v: number) => new Prisma.Decimal(v);
const day = (ymd: string) => new Date(`${ymd}T12:00:00.000Z`);
const actor = { id: 'admin-1', email: 'a@x', tenantId: 't1' } as never;

/** A completed, vendor-assigned request (completed mid-day IST on `ymd`). */
const sr = (id: string, vendor: string, ymd: string, extra: Record<string, unknown> = {}) => ({
  id, number: Number(id.replace(/\D/g, '')) || 1, title: `Job ${id}`, serviceId: 'svc-clean', quantity: 1,
  completedDate: day(ymd), assignedVendorId: vendor, packagePurchaseId: null,
  service: { name: 'Deep clean', basePrice: D(2000) }, variant: null, unit: { unitNumber: 'A-101' },
  vendorPayoutLine: null, ...extra,
});

function build(opts: {
  requests?: ReturnType<typeof sr>[];
  payments?: { serviceRequestId: string; amount: Prisma.Decimal; refundAmount: Prisma.Decimal | null; status: string }[];
  configs?: Record<string, unknown>[];
  payout?: Record<string, unknown> | null;
  vendorOfUser?: { id: string } | null;
} = {}) {
  const created: Record<string, unknown>[] = [];
  const prisma: Record<string, unknown> = {
    community: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata', name: 'Skyline', logoKey: null }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ tenantId: 't1' }),
    },
    serviceRequest: { findMany: jest.fn().mockResolvedValue(opts.requests ?? []) },
    payment: { findMany: jest.fn().mockResolvedValue(opts.payments ?? []) },
    vendorCommissionConfig: { findMany: jest.fn().mockResolvedValue(opts.configs ?? []) },
    vendor: {
      findMany: jest.fn().mockResolvedValue([{ id: 'v1', name: 'BrightSpark' }, { id: 'v2', name: 'PestAway' }]),
      findFirst: jest.fn().mockResolvedValue(opts.vendorOfUser === undefined ? { id: 'v1', communityIds: [] } : opts.vendorOfUser),
    },
    vendorPayout: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn((args: { where: { vendorId?: string } }) =>
        Promise.resolve(opts.payout && (!args.where.vendorId || args.where.vendorId === opts.payout.vendorId) ? opts.payout : null)),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `p${created.length + 1}`, ...data };
        created.push(row);
        return Promise.resolve(row);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve({ ...opts.payout, status: 'PAID' })),
    },
    vendorPayoutLine: { deleteMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const audit = { record: jest.fn() };
  const svc = new VendorFinanceService(
    prisma as never,
    { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as never,
    audit as never,
    { signedUrl: jest.fn().mockResolvedValue(null), assertOwnedKey: jest.fn(), buildKey: jest.fn(), signUpload: jest.fn() } as never,
  );
  return { svc, prisma: prisma as Record<string, Record<string, jest.Mock>>, created, audit };
}

const pct = (vendorId: string, rate: number, freq: 'WEEKLY' | 'MONTHLY', from = '2026-01-01') => ({
  vendorId, serviceId: null, model: 'PERCENTAGE', rate: D(rate), fixedAmount: null,
  payoutFrequency: freq, effectiveFrom: day(from), isActive: true,
});

describe('VendorFinanceService — earnings', () => {
  it('values a paid request at what was paid less refunds, and applies each vendor’s own commission', async () => {
    const { svc } = build({
      requests: [sr('sr1', 'v1', '2026-11-03'), sr('sr2', 'v2', '2026-11-04')],
      payments: [
        { serviceRequestId: 'sr1', amount: D(10000), refundAmount: null, status: 'PAID' },
        { serviceRequestId: 'sr2', amount: D(10000), refundAmount: D(2000), status: 'PAID' },
      ],
      configs: [pct('v1', 10, 'WEEKLY'), pct('v2', 5, 'MONTHLY')],
    });
    const rows = await svc.transactions('c1', {});
    const a = rows.find((r) => r.serviceRequestId === 'sr1')!;
    const b = rows.find((r) => r.serviceRequestId === 'sr2')!;
    expect([a.serviceValue, a.commission, a.payable]).toEqual([10000, 1000, 9000]);
    expect([b.serviceValue, b.commission, b.payable]).toEqual([8000, 400, 7600]);
    expect(a.period).toEqual({ start: '2026-11-02', end: '2026-11-08', frequency: 'WEEKLY' });
    expect(b.period).toEqual({ start: '2026-11-01', end: '2026-11-30', frequency: 'MONTHLY' });
  });

  it('leaves out fully refunded requests and unpaid non-package requests; values package visits at catalogue price', async () => {
    const { svc } = build({
      requests: [
        sr('sr1', 'v1', '2026-11-03'),
        sr('sr2', 'v1', '2026-11-03'),
        sr('sr3', 'v1', '2026-11-03', { packagePurchaseId: 'pp1', variant: { price: D(1500) }, quantity: 2 }),
      ],
      payments: [{ serviceRequestId: 'sr1', amount: D(900), refundAmount: null, status: 'REFUNDED' }],
    });
    const rows = await svc.transactions('c1', {});
    expect(rows.map((r) => r.serviceRequestId)).toEqual(['sr3']);
    expect(rows[0]).toMatchObject({ basis: 'PACKAGE', serviceValue: 3000, commission: 0, payable: 3000 });
  });

  it('a request already on a statement shows its frozen figures, not a recalculation', async () => {
    const { svc } = build({
      requests: [sr('sr1', 'v1', '2026-11-03', {
        vendorPayoutLine: {
          basis: 'PAID', serviceValue: D(5000), commissionModel: 'PERCENTAGE', commissionRate: D(10), commission: D(500), payable: D(4500),
          payout: { id: 'p9', number: 'VPO-202611-000009', status: 'PAID', frequency: 'MONTHLY', periodStart: day('2026-11-01'), periodEnd: day('2026-11-30') },
        },
      })],
      // Terms have since changed to 20% — the paid line must not move.
      configs: [pct('v1', 20, 'MONTHLY')],
    });
    const [row] = await svc.transactions('c1', {});
    expect(row).toMatchObject({ commission: 500, payable: 4500, payoutStatus: 'PAID', payoutNumber: 'VPO-202611-000009' });
  });

  it('filters by the community’s calendar day across a period boundary', async () => {
    const { svc } = build({
      requests: [sr('sr1', 'v1', '2026-11-30'), sr('sr2', 'v1', '2026-12-01')],
      payments: [
        { serviceRequestId: 'sr1', amount: D(100), refundAmount: null, status: 'PAID' },
        { serviceRequestId: 'sr2', amount: D(100), refundAmount: null, status: 'PAID' },
      ],
    });
    expect((await svc.transactions('c1', { from: '2026-12-01', to: '2026-12-31' })).map((r) => r.serviceRequestId)).toEqual(['sr2']);
  });
});

describe('VendorFinanceService — payouts', () => {
  it('groups only closed periods, one statement per vendor per period, totals = sum of lines', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T06:00:00Z'));
    const { svc, created } = build({
      requests: [
        sr('sr1', 'v1', '2026-11-03'), sr('sr2', 'v1', '2026-11-05'), // week of 2 Nov — closed
        sr('sr3', 'v1', '2026-11-10'),                                // week of 9 Nov — closed
        sr('sr4', 'v1', '2026-11-20'),                                // current week — open, skipped
        sr('sr5', 'v2', '2026-11-04'),                                // v2 monthly, November still open
      ],
      payments: ['sr1', 'sr2', 'sr3', 'sr4', 'sr5'].map((id) => ({ serviceRequestId: id, amount: D(1000), refundAmount: null, status: 'PAID' })),
      configs: [pct('v1', 10, 'WEEKLY'), pct('v2', 5, 'MONTHLY')],
    });
    const result = await svc.generatePayouts('c1', undefined, actor);
    jest.useRealTimers();
    expect(result.created).toBe(2);
    const first = created.find((p) => (p.periodStart as Date).toISOString().startsWith('2026-11-02'))!;
    expect(Number(first.serviceValue)).toBe(2000);
    expect(Number(first.commission)).toBe(200);
    expect(Number(first.payable)).toBe(1800);
    expect((first.lines as { create: unknown[] }).create).toHaveLength(2);
    expect(created.every((p) => p.vendorId === 'v1')).toBe(true);
  });

  it('a concurrent run that already took the requests is skipped, not double-counted', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T06:00:00Z'));
    const { svc, prisma } = build({
      requests: [sr('sr1', 'v1', '2026-11-03')],
      payments: [{ serviceRequestId: 'sr1', amount: D(1000), refundAmount: null, status: 'PAID' }],
      configs: [pct('v1', 10, 'WEEKLY')],
    });
    prisma.vendorPayout.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    const result = await svc.generatePayouts('c1', undefined, actor);
    jest.useRealTimers();
    expect(result.created).toBe(0);
  });

  const pending = { id: 'p1', communityId: 'c1', vendorId: 'v1', number: 'VPO-1', status: 'PENDING', payable: D(9000), vendorInvoiceKey: null };

  it('records a payout once, for exactly the payable amount', async () => {
    const { svc, prisma, audit } = build({ payout: pending });
    await svc.markPaid('c1', 'p1', { amount: 9000, paidAt: '2026-11-20', reference: 'UTR123' }, actor);
    expect(prisma.vendorPayout.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'p1', communityId: 'c1', status: 'PENDING' },
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vendor_payout.paid' }));
  });

  it('refuses an amount above (or below) the payable', async () => {
    const { svc } = build({ payout: pending });
    await expect(svc.markPaid('c1', 'p1', { amount: 9500, paidAt: '2026-11-20', reference: 'X' }, actor))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to pay an already-paid payout', async () => {
    const { svc } = build({ payout: { ...pending, status: 'PAID' } });
    await expect(svc.markPaid('c1', 'p1', { amount: 9000, paidAt: '2026-11-20', reference: 'X' }, actor))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('loses the race cleanly: a second simultaneous "pay" gets a conflict', async () => {
    const { svc, prisma } = build({ payout: pending });
    prisma.vendorPayout.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.markPaid('c1', 'p1', { amount: 9000, paidAt: '2026-11-20', reference: 'X' }, actor))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('cancelling releases the lines; a paid payout cannot be cancelled', async () => {
    const ok = build({ payout: pending });
    await ok.svc.cancelPayout('c1', 'p1', { reason: 'generated early' }, actor);
    expect(ok.prisma.vendorPayoutLine.deleteMany).toHaveBeenCalledWith({ where: { payoutId: 'p1' } });
    const paid = build({ payout: { ...pending, status: 'PAID' } });
    await expect(paid.svc.cancelPayout('c1', 'p1', { reason: 'x' }, actor)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('VendorFinanceService — isolation', () => {
  it('a vendor cannot open another vendor’s payout', async () => {
    const { svc } = build({ payout: { id: 'p1', communityId: 'c1', vendorId: 'v2', lines: [] } });
    await expect(svc.getPayout('c1', 'p1', 'v1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a non-vendor user has no earnings view', async () => {
    const { svc } = build({ vendorOfUser: null });
    await expect(svc.myOverview('c1', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a vendor’s overview queries only their own requests', async () => {
    const { svc, prisma } = build({ requests: [] });
    await svc.myOverview('c1', actor);
    expect(prisma.serviceRequest.findMany.mock.calls[0][0].where).toMatchObject({ communityId: 'c1', assignedVendorId: 'v1' });
    expect(prisma.vendorPayout.findMany.mock.calls.every((c: [{ where: { vendorId: string } }]) => c[0].where.vendorId === 'v1')).toBe(true);
  });
});
