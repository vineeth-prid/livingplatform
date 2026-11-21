import { Prisma } from '@prisma/client';

import { commissionFor, commissionableAmount, frequencyOf, periodOf, termsAt, type ConfigRow } from './vendor-finance.math';

const D = (v: number | string) => new Prisma.Decimal(v);
const day = (ymd: string) => new Date(`${ymd}T12:00:00.000Z`);
const cfg = (over: Partial<ConfigRow>): ConfigRow => ({
  model: 'PERCENTAGE', rate: D(10), fixedAmount: null, serviceId: null,
  effectiveFrom: day('2026-01-01'), isActive: true, payoutFrequency: 'MONTHLY', ...over,
});

describe('commissionFor', () => {
  it('percentage: ₹10,000 at 10% → ₹1,000 commission, ₹9,000 payable', () => {
    const r = commissionFor(D(10000), cfg({}));
    expect(r.commission.toString()).toBe('1000');
    expect(r.payable.toString()).toBe('9000');
  });
  it('fixed: ₹10,000 with ₹500 fixed → ₹9,500 payable', () => {
    const r = commissionFor(D(10000), cfg({ model: 'FIXED', rate: null, fixedAmount: D(500) }));
    expect(r.payable.toString()).toBe('9500');
  });
  it('none: full amount payable', () => {
    expect(commissionFor(D(2500), cfg({ model: 'NONE', rate: null })).payable.toString()).toBe('2500');
    expect(commissionFor(D(2500), null).commission.toString()).toBe('0');
  });
  it('never pays out a negative amount: a fixed fee is capped at the service value', () => {
    const r = commissionFor(D(300), cfg({ model: 'FIXED', fixedAmount: D(500) }));
    expect(r.commission.toString()).toBe('300');
    expect(r.payable.toString()).toBe('0');
  });
  it('is exact to the paisa (no float drift): ₹999.99 at 7.5%', () => {
    const r = commissionFor(D('999.99'), cfg({ rate: D('7.5') }));
    expect(r.commission.toString()).toBe('75'); // 74.99925 → 75.00 half-up
    expect(r.payable.toString()).toBe('924.99');
    expect(r.commission.add(r.payable).toString()).toBe('999.99');
  });
});

describe('termsAt', () => {
  const configs = [
    cfg({ rate: D(10), effectiveFrom: day('2026-01-01') }),
    cfg({ rate: D(12), effectiveFrom: day('2026-09-01') }),
    cfg({ rate: D(5), serviceId: 'svc-ac', effectiveFrom: day('2026-01-01') }),
    cfg({ rate: D(50), effectiveFrom: day('2026-02-01'), isActive: false }),
  ];
  it('uses the terms effective on the completion day (rate change honoured by date)', () => {
    expect(termsAt(configs, 'svc-clean', day('2026-08-31'))!.rate!.toString()).toBe('10');
    expect(termsAt(configs, 'svc-clean', day('2026-09-01'))!.rate!.toString()).toBe('12');
  });
  it('a service-specific rate beats the vendor default', () => {
    expect(termsAt(configs, 'svc-ac', day('2026-10-01'))!.rate!.toString()).toBe('5');
  });
  it('ignores inactive rows and anything not yet effective', () => {
    expect(termsAt(configs, 'svc-clean', day('2025-12-31'))).toBeNull();
  });
  it('frequency follows the latest default terms', () => {
    expect(frequencyOf([cfg({}), cfg({ payoutFrequency: 'WEEKLY', effectiveFrom: day('2026-06-01') })], day('2026-07-01'))).toBe('WEEKLY');
    expect(frequencyOf([], day('2026-07-01'))).toBe('MONTHLY');
  });
});

describe('periodOf', () => {
  it('weekly periods run Monday to Sunday, across a month boundary', () => {
    expect(periodOf('2026-11-21', 'WEEKLY')).toEqual({ start: '2026-11-16', end: '2026-11-22' }); // Sat
    expect(periodOf('2026-12-02', 'WEEKLY')).toEqual({ start: '2026-11-30', end: '2026-12-06' }); // crosses months
    expect(periodOf('2026-11-16', 'WEEKLY').start).toBe('2026-11-16'); // Monday is its own start
    expect(periodOf('2026-11-22', 'WEEKLY').end).toBe('2026-11-22'); // Sunday is the end
  });
  it('monthly periods are calendar months (leap February included)', () => {
    expect(periodOf('2026-11-30', 'MONTHLY')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodOf('2028-02-10', 'MONTHLY')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
});

describe('commissionableAmount', () => {
  it('paid request: the amount paid less refunds', () => {
    expect(commissionableAmount({ paidAmount: D(1200), refundAmount: D(200), isPackageRedemption: false, cataloguePrice: null }))
      .toEqual({ basis: 'PAID', amount: D(1000) });
  });
  it('fully refunded: not eligible', () => {
    expect(commissionableAmount({ paidAmount: D(1200), refundAmount: D(1200), isPackageRedemption: false, cataloguePrice: null })).toBeNull();
  });
  it('package redemption: the catalogue price', () => {
    expect(commissionableAmount({ paidAmount: null, refundAmount: null, isPackageRedemption: true, cataloguePrice: D(799) }))
      .toEqual({ basis: 'PACKAGE', amount: D(799) });
  });
  it('nothing collected and not a package: not eligible', () => {
    expect(commissionableAmount({ paidAmount: null, refundAmount: null, isPackageRedemption: false, cataloguePrice: D(500) })).toBeNull();
  });
});
