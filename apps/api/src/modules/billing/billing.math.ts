import { BillingCycle } from '@prisma/client';

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
 * The period containing `anchor`, aligned to the calendar:
 *   MONTHLY   → the whole month
 *   QUARTERLY → Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec
 *   YEARLY    → Jan–Dec
 * `end` is the last instant of the last day, so `periodEnd` is inclusive.
 */
export function periodFor(cycle: BillingCycle, anchor: Date): BillingPeriod {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const span = monthsIn(cycle);
  const startMonth = Math.floor(month / span) * span;
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, startMonth + span, 0, 23, 59, 59, 999));
  return { start, end };
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
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
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
  const graceEnd = new Date(input.dueDate.getTime() + grace * 86_400_000);
  if (input.asOf.getTime() <= graceEnd.getTime()) return 0;

  const flat = rates.lateFeeAmount ?? 0;
  const pct = ((rates.lateFeePercent ?? 0) / 100) * input.outstanding;
  return round2(flat + pct);
}

/** Days a bill is overdue as of `asOf` (0 when not yet due). */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  const diff = asOf.getTime() - dueDate.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000);
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
