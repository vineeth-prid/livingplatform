import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, PackageCheck, Timer, Truck, XCircle } from 'lucide-react';
import {
  Card, EmptyState, LoadingState, PageContainer, PageHeader, PageTransition, StatCard,
} from '@living/ui';
import { cn } from '@living/utils';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { formatDuration } from './gate-lib';

const WINDOWS = [7, 30, 90] as const;

/**
 * Delivery analytics.
 *
 * Charts are hand-rolled SVG/CSS, matching the platform-admin dashboards — the
 * portal has no charting dependency and four small charts do not justify
 * adding one.
 */
export function GateAnalyticsPage() {
  const { communityId } = useCommunity();
  const [days, setDays] = useState<number>(30);

  const query = useQuery({
    queryKey: ['gate-statistics', communityId, days],
    queryFn: () => living.gate.statistics(communityId!, days),
    enabled: !!communityId,
  });

  if (query.isLoading) return <LoadingState label="Loading delivery analytics…" />;
  const stats = query.data;
  if (!stats) return <LoadingState label="No data" />;

  const peakMax = Math.max(1, ...stats.peakHours.map((h) => h.count));
  const trendMax = Math.max(1, ...stats.trend.map((t) => t.count));
  const vendorMax = Math.max(1, ...stats.topVendors.map((v) => v.count));

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          title="Delivery analytics"
          description="Volumes, responsiveness and who is actually delivering to your community."
          actions={
            <div className="inline-flex gap-1">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setDays(w)}
                  className={cn(
                    'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
                    days === w ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted',
                  )}
                >
                  {w}d
                </button>
              ))}
            </div>
          }
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's deliveries" value={stats.today.total} icon={Truck} />
          <StatCard
            label="Pending approvals"
            value={stats.pendingApprovals}
            icon={Clock}
            tone={stats.pendingApprovals > 0 ? 'warning' : undefined}
          />
          <StatCard
            label="Avg. approval time"
            value={formatDuration(stats.averageApprovalSeconds)}
            icon={Timer}
          />
          <StatCard
            label={`Rejected (${days}d)`}
            value={stats.rejectedInWindow}
            icon={XCircle}
            tone={stats.rejectedInWindow > 0 ? 'danger' : undefined}
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card variant="elevated">
            <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Today</h2>
            <p className="mb-4 text-sm text-muted">Where today's arrivals currently stand.</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Pending" value={stats.today.pending} />
              <Tile label="Approved" value={stats.today.approved} />
              <Tile label="Rejected" value={stats.today.rejected} />
              <Tile label="Completed" value={stats.today.completed} />
            </dl>
          </Card>

          <Card variant="elevated">
            <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Peak hours</h2>
            <p className="mb-4 text-sm text-muted">
              When the gate is busiest — staff the desk accordingly.
            </p>
            {stats.peakHours.every((h) => h.count === 0) ? (
              <EmptyState title="No deliveries in this window" />
            ) : (
              <div className="flex h-32 items-end gap-[2px]" role="img" aria-label="Deliveries by hour of day">
                {stats.peakHours.map((h) => (
                  <div key={h.hour} className="group relative flex-1">
                    <div
                      className="w-full rounded-t-sm bg-brand transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(2, (h.count / peakMax) * 100)}%` }}
                      title={`${String(h.hour).padStart(2, '0')}:00 — ${h.count}`}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex justify-between text-2xs text-subtle">
              <span>00:00</span><span>12:00</span><span>23:00</span>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card variant="elevated">
            <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Top vendors</h2>
            <p className="mb-4 text-sm text-muted">Who delivers here most over the last {days} days.</p>
            {stats.topVendors.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No vendor data yet" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {stats.topVendors.map((v) => (
                  <li key={v.vendorName} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm text-body">{v.vendorName}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${(v.count / vendorMax) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm text-muted" data-numeric>
                      {v.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card variant="elevated">
            <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Daily volume</h2>
            <p className="mb-4 text-sm text-muted">Deliveries per day over the last {days} days.</p>
            {stats.trend.length === 0 ? (
              <EmptyState title="No deliveries in this window" />
            ) : (
              <div className="flex h-32 items-end gap-[2px]" role="img" aria-label="Deliveries per day">
                {stats.trend.map((point) => (
                  <div
                    key={point.date}
                    className="flex-1 rounded-t-sm bg-tint"
                    style={{ height: `${Math.max(2, (point.count / trendMax) * 100)}%` }}
                    title={`${point.date} — ${point.count}`}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </PageContainer>
    </PageTransition>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-sunken px-3 py-2.5">
      <dt className="text-2xs uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="mt-0.5 font-display text-h3 leading-none tracking-tight text-strong" data-numeric>
        {value}
      </dd>
    </div>
  );
}
