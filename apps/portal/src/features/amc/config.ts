import type { BadgeProps } from '@living/ui';

type Tone = NonNullable<BadgeProps['tone']>;

export const AMC_STATUS = ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWAL_PENDING'] as const;
export const COVERAGE_TYPE = ['FULL', 'PARTIAL', 'LABOUR_ONLY', 'PARTS_ONLY', 'INSPECTION_ONLY'] as const;
export const PAYMENT_FREQUENCY = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const;

export const STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'neutral', ACTIVE: 'success', EXPIRED: 'danger', TERMINATED: 'neutral', RENEWAL_PENDING: 'warning',
};

export const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

/** Format a decimal-string cost with its currency (money is a string over the wire). */
export function formatMoney(cost: string | number | null | undefined, currency = 'INR'): string {
  if (cost == null || cost === '') return '—';
  const n = Number(cost);
  if (Number.isNaN(n)) return String(cost);
  // Pinned to en-IN (India-first platform) so grouping is deterministic.
  return `${currency} ${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export type ContractHealth = 'active' | 'renewal' | 'expiring' | 'expired' | 'draft' | 'terminated';

/** Contract health for the renewal indicator, from status + end date. */
export function contractHealth(status: string, endDate: string, now: Date = new Date()): ContractHealth {
  if (status === 'DRAFT') return 'draft';
  if (status === 'TERMINATED') return 'terminated';
  if (status === 'EXPIRED') return 'expired';
  if (status === 'RENEWAL_PENDING') return 'renewal';
  const end = new Date(endDate).getTime();
  if (end < now.getTime()) return 'expired';
  if (end <= now.getTime() + 30 * DAY_MS) return 'expiring';
  return 'active';
}
