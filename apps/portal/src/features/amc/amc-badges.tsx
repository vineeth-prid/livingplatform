import { CalendarClock, RefreshCw, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge, type BadgeProps } from '@living/ui';
import { cn } from '@living/utils';

import { STATUS_TONE, contractHealth, humanize, type ContractHealth } from './config';

export function AmcStatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}

export function CoverageTypeBadge({ type, size = 'sm' }: { type: string; size?: BadgeProps['size'] }) {
  return <Badge tone="info" size={size}>{humanize(type)}</Badge>;
}

const HEALTH: Record<ContractHealth, { label: string; className: string; Icon: typeof ShieldCheck }> = {
  active: { label: 'Active', className: 'text-[var(--success)]', Icon: ShieldCheck },
  expiring: { label: 'Expiring soon', className: 'text-[var(--warning)]', Icon: ShieldAlert },
  renewal: { label: 'Renewal due', className: 'text-[var(--warning)]', Icon: RefreshCw },
  expired: { label: 'Expired', className: 'text-[var(--danger)]', Icon: ShieldX },
  draft: { label: 'Draft', className: 'text-subtle', Icon: CalendarClock },
  terminated: { label: 'Terminated', className: 'text-subtle', Icon: ShieldX },
};

/** Renewal/expiry health indicator from status + end date. */
export function RenewalIndicator({ status, endDate, showLabel = true }: { status: string; endDate: string; showLabel?: boolean }) {
  const meta = HEALTH[contractHealth(status, endDate)];
  const { label, className, Icon } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)} title={label}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && label}
    </span>
  );
}
