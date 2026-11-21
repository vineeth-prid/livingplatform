import { Prisma, type CommissionModel, type PayoutFrequency } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

export interface CommissionTerms {
  model: CommissionModel;
  rate: Dec | null;
  fixedAmount: Dec | null;
}

export interface ConfigRow extends CommissionTerms {
  serviceId: string | null;
  effectiveFrom: Date;
  isActive: boolean;
  payoutFrequency: PayoutFrequency;
}

/**
 * Commission and vendor payable for one transaction, in exact decimal
 * arithmetic, rounded to the paisa (half-up).
 *
 *   PERCENTAGE  commission = base × rate / 100
 *   FIXED       commission = fixedAmount, capped at base
 *   NONE        commission = 0
 *   payable     = base − commission   (never negative)
 */
export function commissionFor(base: Dec, terms: CommissionTerms | null): { commission: Dec; payable: Dec } {
  const amount = D.max(base, 0);
  let commission = new D(0);
  if (terms?.model === 'PERCENTAGE' && terms.rate) {
    commission = amount.mul(terms.rate).div(100).toDecimalPlaces(2, D.ROUND_HALF_UP);
  } else if (terms?.model === 'FIXED' && terms.fixedAmount) {
    commission = D.min(terms.fixedAmount, amount);
  }
  return { commission, payable: amount.sub(commission) };
}

/**
 * The terms that applied to a transaction: active rows effective on or before
 * the completion day; a row for this exact service beats the vendor default;
 * the latest effectiveFrom wins. Null = no terms → no commission.
 */
export function termsAt(configs: ConfigRow[], serviceId: string, at: Date): ConfigRow | null {
  const live = configs
    .filter((c) => c.isActive && c.effectiveFrom.getTime() <= at.getTime())
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return live.find((c) => c.serviceId === serviceId) ?? live.find((c) => c.serviceId === null) ?? null;
}

/** The vendor's payout frequency today (its latest effective default terms), MONTHLY if none. */
export function frequencyOf(configs: ConfigRow[], now = new Date()): PayoutFrequency {
  const live = configs
    .filter((c) => c.isActive && c.serviceId === null && c.effectiveFrom.getTime() <= now.getTime())
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return live[0]?.payoutFrequency ?? 'MONTHLY';
}

/** Calendar day (YYYY-MM-DD) of an instant in a timezone. */
export function dayIn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/**
 * The payout period containing a calendar day: WEEKLY is Monday–Sunday,
 * MONTHLY the calendar month. Both bounds are inclusive YYYY-MM-DD days.
 */
export function periodOf(ymd: string, frequency: PayoutFrequency): { start: string; end: string } {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  if (frequency === 'MONTHLY') {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
  }
  const day = new Date(Date.UTC(y, m - 1, d));
  const back = (day.getUTCDay() + 6) % 7; // days since Monday
  const start = new Date(day.getTime() - back * 86_400_000);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * What a completed request is worth to the vendor before commission:
 *   • paid requests — what the resident paid, less any refund (PAID basis);
 *   • package redemptions — the service's catalogue price (PACKAGE basis);
 *   • anything else (nothing collected) — not eligible.
 * A fully refunded request is worth 0 and is not eligible.
 */
export function commissionableAmount(input: {
  paidAmount: Dec | null;
  refundAmount: Dec | null;
  isPackageRedemption: boolean;
  cataloguePrice: Dec | null;
}): { basis: 'PAID' | 'PACKAGE'; amount: Dec } | null {
  if (input.paidAmount) {
    const net = input.paidAmount.sub(input.refundAmount ?? 0);
    return net.gt(0) ? { basis: 'PAID', amount: net } : null;
  }
  if (input.isPackageRedemption && input.cataloguePrice?.gt(0)) {
    return { basis: 'PACKAGE', amount: input.cataloguePrice };
  }
  return null;
}
