import type { ExpensePeriod } from './dto/expense.dto';

/**
 * Expense dates are calendar days. Each is stored at 12:00 UTC (the same
 * convention billing uses), so a day never slips into its neighbour in any
 * timezone and a month is simply the days whose date string starts "YYYY-MM".
 * The community's timezone matters only for deciding what "today" — and so
 * "this month" — is.
 */

/** Today's date in a timezone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The stored instant for a calendar day. */
export function atMidday(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

/** The calendar day of a stored instant. */
export function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** First and last day (inclusive) of the month containing `ymd`, shifted by `offset` months. */
export function monthBounds(ymd: string, offset = 0): { from: string; to: string } {
  const [y, m] = ymd.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const year = d.getUTCFullYear();
  const month1 = d.getUTCMonth() + 1;
  const mm = String(month1).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDayOfMonth(year, month1)).padStart(2, '0')}` };
}

export function periodBounds(period: ExpensePeriod, timeZone: string, now = new Date()): { from: string; to: string } {
  const today = todayIn(timeZone, now);
  if (period === 'current-month') return monthBounds(today);
  if (period === 'previous-month') return monthBounds(today, -1);
  return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
}

/** A Prisma date filter for an inclusive day range (either end optional). */
export function dayRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const next = new Date(`${to}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    range.lt = next;
  }
  return range;
}
