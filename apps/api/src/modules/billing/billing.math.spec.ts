import { BillingCycle } from '@prisma/client';

import {
  amountFor,
  chargeInForce,
  daysInPeriod,
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
    expect(p.start.toISOString()).toBe('2026-08-01T12:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-08-31T12:00:00.000Z');
  });

  it('aligns a quarterly period to the calendar quarter', () => {
    const p = periodFor(BillingCycle.QUARTERLY, utc(2026, 8, 17));
    expect(p.start.toISOString()).toBe('2026-07-01T12:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });

  it('aligns a yearly period to the calendar year', () => {
    const p = periodFor(BillingCycle.YEARLY, utc(2026, 8, 17));
    expect(p.start.toISOString()).toBe('2026-01-01T12:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-12-31T12:00:00.000Z');
  });

  it('handles February in a leap year', () => {
    const p = periodFor(BillingCycle.MONTHLY, utc(2028, 2, 3));
    expect(p.end.toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });

  it('rolls a December monthly period into the next January', () => {
    const p = nextPeriod(BillingCycle.MONTHLY, periodFor(BillingCycle.MONTHLY, utc(2026, 12, 5)));
    expect(p.start.toISOString()).toBe('2027-01-01T12:00:00.000Z');
  });
});

/**
 * A period and a due date are CALENDAR markers, and they are rendered with the
 * reader's timezone. Stamped at midnight or at 23:59:59.999 UTC they landed on
 * the neighbouring day for anyone not on UTC: an Indian admin saw an August
 * invoice as "1 Aug – 1 Sep" and a bill due the 10th as due the 11th, which is
 * the wrong maintenance day count that was reported.
 *
 * India (+05:30) and Hawaii (-10:00) bracket the range a community can be in.
 */
describe('calendar markers survive the reader’s timezone', () => {
  const dayIn = (tz: string, d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD

  const august = periodFor(BillingCycle.MONTHLY, utc(2026, 8, 17));
  const due = dueDateFor(august, 10);

  it('reads as 1–31 August in India', () => {
    expect(dayIn('Asia/Kolkata', august.start)).toBe('2026-08-01');
    expect(dayIn('Asia/Kolkata', august.end)).toBe('2026-08-31');
    expect(dayIn('Asia/Kolkata', due)).toBe('2026-08-10');
  });

  it('reads as 1–31 August in Hawaii too', () => {
    expect(dayIn('Pacific/Honolulu', august.start)).toBe('2026-08-01');
    expect(dayIn('Pacific/Honolulu', august.end)).toBe('2026-08-31');
    expect(dayIn('Pacific/Honolulu', due)).toBe('2026-08-10');
  });

  it('spans the 31 days of August, not 32', () => {
    expect(daysInPeriod(august)).toBe(31);
    expect(daysInPeriod(periodFor(BillingCycle.MONTHLY, utc(2028, 2, 3)))).toBe(29);
    expect(daysInPeriod(periodFor(BillingCycle.QUARTERLY, utc(2026, 8, 17)))).toBe(92);
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
    expect(due.toISOString()).toBe('2026-08-10T12:00:00.000Z');
  });

  it('clamps a day the month does not have', () => {
    const due = dueDateFor(periodFor(BillingCycle.MONTHLY, utc(2026, 2, 1)), 31);
    expect(due.toISOString()).toBe('2026-02-28T12:00:00.000Z');
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

/**
 * Days overdue, counted the way a person counts on a calendar.
 *
 * Both sides are normalised to midnight, so the whole due day is on time and
 * the day after is exactly one day late — independent of the time of day the
 * due date is stamped at. Subtracting raw instants made the answer depend on
 * that stamp, and every invoice under-reported by a day.
 */
describe('daysOverdue — calendar days, not elapsed time', () => {
  const due = dueDateFor({ start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 7, 31)) }, 10);
  const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 7, day, hour));

  it('is 0 on the due day itself, whatever the hour', () => {
    expect(daysOverdue(due, at(10, 0))).toBe(0);
    expect(daysOverdue(due, at(10, 23))).toBe(0);
  });

  it('is 1 the day after — this is the case that reported 0', () => {
    expect(daysOverdue(due, at(11, 0))).toBe(1);
    expect(daysOverdue(due, at(11, 23))).toBe(1);
  });

  it('counts each further day exactly once', () => {
    expect(daysOverdue(due, at(12))).toBe(2);
    expect(daysOverdue(due, at(20))).toBe(10);
  });

  it('is 0 before the due date', () => {
    expect(daysOverdue(due, at(9))).toBe(0);
    expect(daysOverdue(due, at(1))).toBe(0);
  });
});

describe('late fee grace uses the same day count as the invoice', () => {
  const due = dueDateFor({ start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 7, 31)) }, 10);
  const rates = { gracePeriodDays: 3, lateFeeAmount: 100, lateFeePercent: 0 } as never;
  const at = (day: number) => new Date(Date.UTC(2026, 7, day, 9));

  it('charges nothing through the last day of grace', () => {
    expect(lateFeeFor(rates, { outstanding: 5000, dueDate: due, asOf: at(13) })).toBe(0);
  });

  it('charges on the day AFTER grace expires', () => {
    expect(lateFeeFor(rates, { outstanding: 5000, dueDate: due, asOf: at(14) })).toBe(100);
  });

  it('never charges a settled bill', () => {
    expect(lateFeeFor(rates, { outstanding: 0, dueDate: due, asOf: at(30) })).toBe(0);
  });
});
