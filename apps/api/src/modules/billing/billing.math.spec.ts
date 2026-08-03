import { BillingCycle } from '@prisma/client';

import {
  amountFor,
  chargeInForce,
  daysOverdue,
  dueDateFor,
  invoiceNumber,
  lateFeeFor,
  nextPeriod,
  periodFor,
  round2,
} from './billing.math';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('periodFor', () => {
  it('aligns a monthly period to the calendar month', () => {
    const p = periodFor(BillingCycle.MONTHLY, utc(2026, 8, 17));
    expect(p.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-08-31T23:59:59.999Z');
  });

  it('aligns a quarterly period to the calendar quarter', () => {
    const p = periodFor(BillingCycle.QUARTERLY, utc(2026, 8, 17));
    expect(p.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-09-30T23:59:59.999Z');
  });

  it('aligns a yearly period to the calendar year', () => {
    const p = periodFor(BillingCycle.YEARLY, utc(2026, 8, 17));
    expect(p.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('handles February in a leap year', () => {
    const p = periodFor(BillingCycle.MONTHLY, utc(2028, 2, 3));
    expect(p.end.toISOString()).toBe('2028-02-29T23:59:59.999Z');
  });

  it('rolls a December monthly period into the next January', () => {
    const p = nextPeriod(BillingCycle.MONTHLY, periodFor(BillingCycle.MONTHLY, utc(2026, 12, 5)));
    expect(p.start.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('amountFor', () => {
  const rates = { monthlyAmount: 3000 };

  it('derives quarterly and yearly from the monthly rate when unpriced', () => {
    expect(amountFor(rates, BillingCycle.MONTHLY)).toBe(3000);
    expect(amountFor(rates, BillingCycle.QUARTERLY)).toBe(9000);
    expect(amountFor(rates, BillingCycle.YEARLY)).toBe(36000);
  });

  it('prefers an explicitly priced cycle (annual discounts)', () => {
    expect(amountFor({ ...rates, yearlyAmount: 33000 }, BillingCycle.YEARLY)).toBe(33000);
  });

  it('falls back to the derived amount when an explicit price is zero', () => {
    expect(amountFor({ ...rates, quarterlyAmount: 0 }, BillingCycle.QUARTERLY)).toBe(9000);
  });
});

describe('dueDateFor', () => {
  it('uses the requested day of the first month of the period', () => {
    const due = dueDateFor(periodFor(BillingCycle.MONTHLY, utc(2026, 8, 1)), 10);
    expect(due.toISOString()).toBe('2026-08-10T23:59:59.999Z');
  });

  it('clamps a day the month does not have', () => {
    const due = dueDateFor(periodFor(BillingCycle.MONTHLY, utc(2026, 2, 1)), 31);
    expect(due.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });
});

describe('lateFeeFor', () => {
  const dueDate = utc(2026, 8, 10);
  const rates = { monthlyAmount: 3000, lateFeeAmount: 100, lateFeePercent: 2, gracePeriodDays: 5 };

  it('charges nothing inside the grace period', () => {
    expect(lateFeeFor(rates, { outstanding: 3000, dueDate, asOf: utc(2026, 8, 14) })).toBe(0);
  });

  it('charges nothing exactly at the end of the grace period', () => {
    expect(lateFeeFor(rates, { outstanding: 3000, dueDate, asOf: utc(2026, 8, 15) })).toBe(0);
  });

  it('charges flat + percentage once the grace period has passed', () => {
    expect(lateFeeFor(rates, { outstanding: 3000, dueDate, asOf: utc(2026, 8, 16) })).toBe(160);
  });

  it('charges nothing when there is nothing outstanding', () => {
    expect(lateFeeFor(rates, { outstanding: 0, dueDate, asOf: utc(2026, 9, 30) })).toBe(0);
  });

  it('supports a percentage-only policy', () => {
    const percentOnly = { monthlyAmount: 3000, lateFeePercent: 1.5, gracePeriodDays: 0 };
    expect(lateFeeFor(percentOnly, { outstanding: 2000, dueDate, asOf: utc(2026, 8, 11) })).toBe(30);
  });
});

describe('daysOverdue', () => {
  it('is zero before the due date', () => {
    expect(daysOverdue(utc(2026, 8, 10), utc(2026, 8, 1))).toBe(0);
  });

  it('counts whole days past the due date', () => {
    expect(daysOverdue(utc(2026, 8, 10), utc(2026, 8, 17))).toBe(7);
  });
});

describe('chargeInForce', () => {
  const charges = [
    { id: 'old', effectiveFrom: utc(2025, 1, 1), effectiveTo: null },
    { id: 'current', effectiveFrom: utc(2026, 4, 1), effectiveTo: null },
    { id: 'future', effectiveFrom: utc(2027, 1, 1), effectiveTo: null },
  ];

  it('picks the latest rate effective on or before the period start', () => {
    expect(chargeInForce(charges, utc(2026, 8, 1))?.id).toBe('current');
  });

  it('does not apply a rate that has not started yet', () => {
    expect(chargeInForce(charges, utc(2025, 6, 1))?.id).toBe('old');
  });

  it('applies a scheduled revision once its period arrives', () => {
    expect(chargeInForce(charges, utc(2027, 3, 1))?.id).toBe('future');
  });

  it('ignores an expired rate', () => {
    const expired = [{ id: 'expired', effectiveFrom: utc(2025, 1, 1), effectiveTo: utc(2025, 12, 31) }];
    expect(chargeInForce(expired, utc(2026, 1, 1))).toBeNull();
  });

  it('returns null when nothing applies', () => {
    expect(chargeInForce([], utc(2026, 1, 1))).toBeNull();
  });
});

describe('invoiceNumber', () => {
  it('is sortable and zero-padded', () => {
    const period = periodFor(BillingCycle.MONTHLY, utc(2026, 8, 1));
    expect(invoiceNumber('INV', period, 42)).toBe('INV-2026-08-000042');
  });
});

describe('round2', () => {
  it('avoids float drift on money', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1234.005)).toBe(1234.01);
  });
});
