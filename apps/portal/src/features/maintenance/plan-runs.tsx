import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Repeat } from 'lucide-react';
import { formatDateTime, timeAgo } from '@living/utils';
import { EmptyState, Skeleton } from '@living/ui';

import { RunStatusBadge } from './maintenance-badges';
import { usePlanRuns } from './queries';

/** Newest-first timeline of generation runs (scheduled / generated / skipped / failed). */
export function PlanRuns({ planId }: { planId: string }) {
  const q = usePlanRuns(planId);
  if (q.isLoading) return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  const runs = [...(q.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (runs.length === 0) return <EmptyState icon={Repeat} title="No runs yet" description="Runs appear each time the plan is due and a work order is generated." />;

  return (
    <ul className="flex flex-col gap-3">
      {runs.map((run) => (
        <li key={run.id} className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
          <div className="min-w-0 flex-1 rounded-card border border-border-subtle bg-card px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RunStatusBadge status={run.status} />
                {run.generationReason && <span className="text-2xs uppercase tracking-wider text-subtle">{run.generationReason.toLowerCase()}</span>}
              </div>
              <span className="text-xs text-subtle" title={formatDateTime(run.createdAt)}>{timeAgo(run.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Scheduled for {formatDateTime(run.scheduledAt)}</p>
            {run.notes && <p className="mt-0.5 text-sm text-body">{run.notes}</p>}
            {run.generatedWorkOrderId && (
              <Link to={`/work-orders/${run.generatedWorkOrderId}` as string} className="mt-1 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                View work order <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
