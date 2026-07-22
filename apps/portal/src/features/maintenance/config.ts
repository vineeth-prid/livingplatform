import type { BadgeProps } from '@living/ui';

type Tone = NonNullable<BadgeProps['tone']>;

export const FREQUENCY = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'] as const;
export const RUN_STATUS = ['SCHEDULED', 'GENERATED', 'SKIPPED', 'FAILED'] as const;

export const RUN_TONE: Record<string, Tone> = {
  SCHEDULED: 'info', GENERATED: 'success', SKIPPED: 'neutral', FAILED: 'danger',
};

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

const UNIT: Record<string, string> = {
  DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', QUARTERLY: 'quarter',
  HALF_YEARLY: 'half-year', YEARLY: 'year',
};

/** A human recurrence label: "Every 2 weeks", "Monthly", or "Custom (cron)". */
export function frequencyLabel(type: string, interval = 1, cron?: string | null): string {
  if (type === 'CUSTOM') return cron ? `Custom · ${cron}` : 'Custom';
  const unit = UNIT[type] ?? humanize(type);
  if (interval <= 1) return `Every ${unit}`;
  return `Every ${interval} ${unit}s`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export type DueState = 'overdue' | 'soon' | 'scheduled' | 'paused';

/** Classify a plan's next-run urgency for the schedule indicator. */
export function dueState(nextRunAt: string, isActive: boolean, now: Date = new Date()): DueState {
  if (!isActive) return 'paused';
  const next = new Date(nextRunAt).getTime();
  if (next < now.getTime()) return 'overdue';
  if (next <= now.getTime() + 7 * DAY_MS) return 'soon';
  return 'scheduled';
}
