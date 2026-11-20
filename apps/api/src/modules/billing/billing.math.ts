import { BillingCycle, Prisma } from '@prisma/client';

/**
 * Pure maintenance-billing arithmetic — no Prisma, no Nest, no I/O, so every
 * rule here is directly testable (see billing.math.spec.ts).
 *
 * All amounts are rupees (the major unit), matching Decimal(14,2) storage.
 * All dates are handled in UTC: a billing period is a calendar boundary, and
 * community timezones only ever shift a due date by hours, never a period.
 */

export interface ChargeRates {
  monthlyAmount: number;
  quarterlyAmount?: number | null;
  yearlyAmount?: number | null;
  lateFeeAmount?: number | null;
  lateFeePercent?: number | null;
  gracePeriodDays?: number | null;
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

const MONTHS_IN: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

/** Months a cycle spans — 1, 3 or 12. */
export function monthsIn(cycle: BillingCycle): number {
  return MONTHS_IN[cycle];
}

/**
 * Midday UTC, not midnight and not 23:59:59.999.
 *
 * `periodEnd` and `dueDate` are CALENDAR MARKERS — "the 31st", "due on the
 * 10th" — but they are stored as instants and rendered with the reader's
 * timezone. Stamped at the last instant of the UTC day, every one of them
 * crossed into the next calendar day for any timezone ahead of UTC: in IST a
 * bill due the 10th displayed as due the 11th, and an August period displayed
 * as "1 Aug – 1 Sep", which is where the wrong day counts came from. Midnight
 * has the mirror problem behind UTC.
 *
 * Midday is the only stamp that lands on the intended day everywhere from
 * UTC-11 to UTC+11, which covers every timezone a community can be in.
 */
const NOON = 12;

/**
 * The period containing `anchor`, aligned to the calendar:
 *   MONTHLY   → the whole month
 *   QUARTERLY → Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec
 *   YEARLY    → Jan–Dec
 * `end` is midday on the last day, so `periodEnd` is inclusive and reads as
 * that day in any community's timezone.
 */
export function periodFor(cycle: BillingCycle, anchor: Date): BillingPeriod {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const span = monthsIn(cycle);
  const startMonth = Math.floor(month / span) * span;
  const start = new Date(Date.UTC(year, startMonth, 1, NOON, 0, 0, 0));
  const end = new Date(Date.UTC(year, startMonth + span, 0, NOON, 0, 0, 0));
  return { start, end };
}

/** Whole calendar days in a period, inclusive of both ends. */
export function daysInPeriod(period: BillingPeriod): number {
  return Math.round((startOfDay(period.end) - startOfDay(period.start)) / 86_400_000) + 1;
}

/** The period immediately after `period` (used to bill the next cycle). */
export function nextPeriod(cycle: BillingCycle, period: BillingPeriod): BillingPeriod {
  const anchor = new Date(
    Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() + monthsIn(cycle), 1),
  );
  return periodFor(cycle, anchor);
}

/**
 * Base amount for a cycle. A rate card may price each cycle explicitly (a
 * community can discount annual payment); when it does not, the cycle is
 * derived from the monthly rate. Never hardcoded, always from the rate card.
 */
export function amountFor(rates: ChargeRates, cycle: BillingCycle): number {
  const explicit =
    cycle === BillingCycle.QUARTERLY
      ? rates.quarterlyAmount
      : cycle === BillingCycle.YEARLY
        ? rates.yearlyAmount
        : rates.monthlyAmount;
  if (explicit !== null && explicit !== undefined && explicit > 0) return round2(explicit);
  return round2(rates.monthlyAmount * monthsIn(cycle));
}

/**
 * The due date for a period: `dueDay` of the period's FIRST month, clamped to
 * the month length (day 31 in February becomes the 28th/29th).
 */
export function dueDateFor(period: BillingPeriod, dueDay: number): Date {
  const year = period.start.getUTCFullYear();
  const month = period.start.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Math.trunc(dueDay)), lastDay);
  return new Date(Date.UTC(year, month, day, NOON, 0, 0, 0));
}

/**
 * Late fee on an outstanding balance. Zero while inside the grace period —
 * flat fee plus percentage, both optional, both from the rate card.
 */
export function lateFeeFor(
  rates: ChargeRates,
  input: { outstanding: number; dueDate: Date; asOf: Date },
): number {
  if (input.outstanding <= 0) return 0;
  const grace = Math.max(0, rates.gracePeriodDays ?? 0);
  // Grace is counted in the same calendar days as `daysOverdue`, or a 3-day
  // grace would expire on a different day from the one the invoice reports.
  if (daysOverdue(input.dueDate, input.asOf) <= grace) return 0;

  const flat = rates.lateFeeAmount ?? 0;
  const pct = ((rates.lateFeePercent ?? 0) / 100) * input.outstanding;
  return round2(flat + pct);
}

/** Midnight UTC on the calendar day of `d` — the unit "days overdue" counts in. */
function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Days a bill is overdue as of `asOf` (0 when not yet due).
 *
 * Counted in CALENDAR days, not elapsed milliseconds: the whole due day counts
 * as on time, and the day after it is "1 day late" — the answer a person gives
 * by counting on a calendar. Subtracting raw instants measured from whatever
 * time of day the due date happened to be stamped at, which under-reported
 * every bill by a day and fed the same arithmetic into late fees.
 *
 * Normalising both sides to midnight is also what makes the midday stamp above
 * safe: the time of day on a due date is not information, so it is discarded.
 */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  const diff = startOfDay(asOf) - startOfDay(dueDate);
  return diff <= 0 ? 0 : Math.round(diff / 86_400_000);
}

/**
 * Pick the rate card in force for a period: the latest row whose
 * `effectiveFrom` is on or before the period start and which has not expired.
 * This is what makes future rate revisions work — insert a row with a future
 * `effectiveFrom` and it takes over automatically when that period arrives.
 */
export function chargeInForce<T extends { effectiveFrom: Date; effectiveTo?: Date | null }>(
  charges: readonly T[],
  periodStart: Date,
): T | null {
  const applicable = charges
    .filter(
      (c) =>
        c.effectiveFrom.getTime() <= periodStart.getTime() &&
        (!c.effectiveTo || c.effectiveTo.getTime() >= periodStart.getTime()),
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return applicable[0] ?? null;
}

/** `INV-2026-07-000042` — sortable, human-readable, unique per community. */
export function invoiceNumber(prefix: string, period: BillingPeriod, sequence: number): string {
  const year = period.start.getUTCFullYear();
  const month = String(period.start.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}-${year}-${month}-${String(sequence).padStart(6, '0')}`;
}

/** `RCPT-20260803-000042` — receipt number for a successful payment. */
export function receiptNumber(paidAt: Date, sequence: number): string {
  const y = paidAt.getUTCFullYear();
  const m = String(paidAt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(paidAt.getUTCDate()).padStart(2, '0');
  return `RCPT-${y}${m}${d}-${String(sequence).padStart(6, '0')}`;
}

/** Money rounding — two decimals, no float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** propertyType of a rate card that applies to every unit type without its own rate. */
export const ALL_UNIT_TYPES = 'ALL';

const SQM_TO_SQFT = new Prisma.Decimal('10.7639');

/**
 * A unit's area in square feet, or null when it cannot be billed by area.
 * Built-up area is the authoritative field; one recorded in square metres is
 * converted. Missing, zero or negative areas return null so the caller can
 * name the unit instead of billing it a wrong amount.
 */
export function areaInSqft(area: Prisma.Decimal | number | null | undefined, areaUnit?: string | null): Prisma.Decimal | null {
  if (area === null || area === undefined) return null;
  const value = new Prisma.Decimal(area);
  if (!value.isFinite() || value.lte(0)) return null;
  const unit = (areaUnit ?? 'sqft').toLowerCase().replace(/[\s._]/g, '');
  return unit === 'sqm' || unit === 'sqmt' || unit === 'm2' ? value.mul(SQM_TO_SQFT).toDecimalPlaces(2) : value;
}

/**
 * Per-square-foot charge for one billing cycle: area × rate × months, in
 * decimal arithmetic and rounded half-up to the paisa ONCE, at the end — so a
 * quarterly bill is exactly three months of the rate, not three rounded months.
 */
export function perSqftAmount(areaSqft: Prisma.Decimal, ratePerSqft: Prisma.Decimal | number, cycle: BillingCycle): number {
  return areaSqft
    .mul(new Prisma.Decimal(ratePerSqft))
    .mul(monthsIn(cycle))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** The rate card for a unit: its own type's rate in force, else the all-types rate. */
export function chargeForUnit<T extends { propertyType: string; effectiveFrom: Date; effectiveTo?: Date | null }>(
  charges: T[],
  unitType: string | null | undefined,
  at: Date,
): T | null {
  const own = unitType ? chargeInForce(charges.filter((c) => c.propertyType === unitType), at) : null;
  return own ?? chargeInForce(charges.filter((c) => c.propertyType === ALL_UNIT_TYPES), at);
}
