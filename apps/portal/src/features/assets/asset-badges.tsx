import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge, type BadgeProps } from '@living/ui';
import { cn } from '@living/utils';

import { CONDITION_TONE, CRITICALITY_TONE, STATUS_TONE, warrantyState, type WarrantyState } from './config';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function AssetStatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}
export function CriticalityPill({ value, size = 'sm' }: { value: string; size?: BadgeProps['size'] }) {
  return <Badge tone={CRITICALITY_TONE[value] ?? 'neutral'} size={size} dot>{humanize(value)}</Badge>;
}
export function ConditionPill({ value, size = 'sm' }: { value: string; size?: BadgeProps['size'] }) {
  return <Badge tone={CONDITION_TONE[value] ?? 'neutral'} size={size}>{humanize(value)}</Badge>;
}

const WARRANTY_META: Record<WarrantyState, { label: string; className: string; Icon: typeof ShieldCheck } | null> = {
  none: null,
  valid: { label: 'In warranty', className: 'text-[var(--success)]', Icon: ShieldCheck },
  expiring: { label: 'Expiring soon', className: 'text-[var(--warning)]', Icon: ShieldAlert },
  expired: { label: 'Expired', className: 'text-[var(--danger)]', Icon: ShieldX },
};

/** A compact warranty health indicator (icon + label), derived from the expiry date. */
export function WarrantyIndicator({ expiry, showLabel = true }: { expiry?: string | null; showLabel?: boolean }) {
  const meta = WARRANTY_META[warrantyState(expiry)];
  if (!meta) return <span className="text-subtle">—</span>;
  const { label, className, Icon } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)} title={label}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && label}
    </span>
  );
}
