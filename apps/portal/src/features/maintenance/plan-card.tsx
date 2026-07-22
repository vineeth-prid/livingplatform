import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import { formatDate } from '@living/utils';
import type { MaintenancePlan } from '@living/types';

import { PriorityPill } from '../operations';
import { frequencyLabel } from './config';
import { NextRunIndicator, PlanStatusBadge } from './maintenance-badges';

/** A maintenance plan card for the register's card view. */
export function PlanCard({ plan }: { plan: MaintenancePlan }) {
  const reduced = useReducedMotion();
  return (
    <Link to={`/maintenance/${plan.id}` as string} className="rounded-card focus-visible:outline-none focus-visible:shadow-ring">
      <motion.div
        whileHover={reduced ? undefined : { y: -2 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full flex-col gap-3 rounded-card border border-border-subtle bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
            <CalendarClock className="h-5 w-5" />
          </span>
          <PlanStatusBadge isActive={plan.isActive} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-strong">{plan.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {plan.asset ? <><span className="font-mono">{plan.asset.assetCode}</span> · {plan.asset.name}</> : 'Asset'}
          </p>
        </div>
        <p className="text-xs text-subtle">{frequencyLabel(plan.frequencyType, plan.frequencyInterval, plan.cronExpression)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <NextRunIndicator nextRunAt={plan.nextRunAt} isActive={plan.isActive}
            label={plan.isActive ? formatDate(plan.nextRunAt) : 'Paused'} />
          <PriorityPill priority={plan.priority} />
        </div>
      </motion.div>
    </Link>
  );
}
