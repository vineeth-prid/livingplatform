import { type ComponentType, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@living/utils';

import { Card } from './card';

/** Dashboard KPI widget — large Geist display value, optional delta, tabular figures. */
export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: 'up' | 'down'; positive?: boolean };
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  const positive = delta?.positive ?? delta?.direction === 'up';
  return (
    <Card variant="elevated" className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted" />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-display-lg leading-none tracking-tight text-strong" data-numeric>
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
    </Card>
  );
}
