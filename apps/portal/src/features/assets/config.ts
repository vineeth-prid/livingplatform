import type { BadgeProps } from '@living/ui';

type Tone = NonNullable<BadgeProps['tone']>;

export const ASSET_STATUS = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED'] as const;
export const ASSET_CRITICALITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const ASSET_CONDITION = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'FAILED'] as const;

export const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success', INACTIVE: 'neutral', UNDER_MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'danger', RETIRED: 'neutral',
};
export const CRITICALITY_TONE: Record<string, Tone> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
export const CONDITION_TONE: Record<string, Tone> = {
  EXCELLENT: 'success', GOOD: 'success', FAIR: 'info', POOR: 'warning', FAILED: 'danger',
};

/** Days before expiry within which a warranty is flagged "expiring". */
export const WARRANTY_SOON_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WarrantyState = 'none' | 'valid' | 'expiring' | 'expired';

/** Classify a warranty expiry date for the warranty indicator. Pure + tested. */
export function warrantyState(expiry: string | null | undefined, now: Date = new Date()): WarrantyState {
  if (!expiry) return 'none';
  const end = new Date(expiry).getTime();
  if (Number.isNaN(end)) return 'none';
  if (end < now.getTime()) return 'expired';
  if (end <= now.getTime() + WARRANTY_SOON_DAYS * DAY_MS) return 'expiring';
  return 'valid';
}
