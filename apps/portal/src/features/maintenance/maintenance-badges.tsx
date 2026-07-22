import { CalendarClock, PauseCircle } from 'lucide-react';
import { Badge, type BadgeProps } from '@living/ui';
import { cn } from '@living/utils';

import { RUN_TONE, dueState } from './config';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

/** Active / Paused plan status. */
export function PlanStatusBadge({ isActive, size = 'sm' }: { isActive: boolean; size?: BadgeProps['size'] }) {
  return <Badge tone={isActive ? 'success' : 'neutral'} size={size} dot>{isActive ? 'Active' : 'Paused'}</Badge>;
}

export function RunStatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return <Badge tone={RUN_TONE[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}

const DUE_META = {
  overdue: { className: 'text-[var(--danger)]', label: 'Overdue' },
  soon: { className: 'text-[var(--warning)]', label: 'Due soon' },
  scheduled: { className: 'text-muted', label: 'Scheduled' },
  paused: { className: 'text-subtle', label: 'Paused' },
} as const;

/** Next-run urgency indicator (icon + relative label). */
export function NextRunIndicator({ nextRunAt, isActive, label }: { nextRunAt: string; isActive: boolean; label?: string }) {
  const state = dueState(nextRunAt, isActive);
  const meta = DUE_META[state];
  const Icon = state === 'paused' ? PauseCircle : CalendarClock;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.className)} title={meta.label}>
      <Icon className="h-3.5 w-3.5" />
      {label ?? meta.label}
    </span>
  );
}
