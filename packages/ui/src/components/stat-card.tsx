import { type ComponentType, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@living/utils';

import { Card } from './card';

export type StatTone = 'default' | 'brand' | 'warning' | 'danger' | 'success';

/** Subtle tonal chip behind the icon — ties the card to its state (Stripe/Linear feel). */
const toneChip: Record<StatTone, string> = {
  default: 'bg-sunken text-muted',
  brand: 'bg-[var(--surface-tint)] text-brand',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger-fg)]',
  success: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
};

/** Dashboard KPI widget — large Geist display value, tonal icon chip, optional delta. */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: ReactNode;
  /** Optional context line under the value (e.g. "3 overdue"). */
  hint?: ReactNode;
  delta?: { value: string; direction: 'up' | 'down'; positive?: boolean };
  icon?: ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}) {
  const positive = delta?.positive ?? delta?.direction === 'up';
  return (
    <Card variant="elevated" className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">
          {label}
        </span>
        {Icon && (
          <span className={cn('grid h-8 w-8 place-items-center rounded-[10px]', toneChip[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-end justify-between gap-3">
        {/* Sized to the viewport within limits (cards share a row of four), and
            allowed to wrap rather than clip: "₹1,00,900.00" must always show whole. */}
        <span
          className="min-w-0 font-display text-[length:clamp(1.5rem,1.9vw,2.75rem)] leading-tight tracking-tight text-strong [overflow-wrap:anywhere]"
          data-numeric
        >
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-sm font-medium',
              positive ? 'text-success-fg' : 'text-danger-fg',
            )}
          >
            {delta.direction === 'up' ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </Card>
  );
}
