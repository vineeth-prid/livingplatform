import { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import type { GateEntry } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Badge, type BadgeProps, Card, EmptyState, Skeleton } from '@living/ui';
import { cn } from '@living/utils';

import { living } from '../lib/living';
import { GateDecisionDialog } from '../gate/gate-alerts';
import { ScreenHeader } from '../shell';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = {
  CREATED: 'info', NOTIFIED: 'info', APPROVED: 'success',
  REJECTED: 'danger', COMPLETED: 'brand', CANCELLED: 'neutral',
};
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const isPending = (e: GateEntry) => e.status === 'CREATED' || e.status === 'NOTIFIED';

/** Everything that has arrived at the gate for this resident. */
export function GateHistoryScreen() {
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [active, setActive] = useState<GateEntry | null>(null);

  const query = useQuery({
    queryKey: ['gate', 'mine', 'history'],
    queryFn: () => living.gate.mine({ limit: 50, sortBy: 'createdAt', sortDir: 'desc' }),
  });

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    return filter === 'pending' ? all.filter(isPending) : all;
  }, [query.data, filter]);

  return (
    <div>
      <ScreenHeader title="At the gate" subtitle="Deliveries" />
      <div className="flex gap-1.5 px-4">
        {([['all', 'All'], ['pending', 'Waiting for you']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn(
              'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
              filter === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 px-4">
        {query.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filter === 'pending' ? 'Nothing waiting' : 'No deliveries yet'}
            description="Deliveries recorded at the gate appear here."
          />
        ) : (
          items.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => isPending(entry) && setActive(entry)}
              className="rounded-card text-left focus-visible:outline-none focus-visible:shadow-ring"
            >
              <Card variant="elevated" className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-strong">
                    {entry.vendorName ?? 'Delivery'} · {entry.personName}
                  </p>
                  <Badge tone={TONE[entry.status] ?? 'neutral'} size="sm" dot>
                    {humanize(entry.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {entry.gate?.name ?? 'Main Gate'} · {formatDateTime(entry.createdAt)}
                </p>
                {isPending(entry) && (
                  <p className="mt-1.5 text-xs font-medium text-brand">Tap to approve or reject</p>
                )}
              </Card>
            </button>
          ))
        )}
      </div>

      <GateDecisionDialog
        entry={active}
        onClose={() => { setActive(null); void query.refetch(); }}
      />
    </div>
  );
}

/**
 * Deep-link target for a push notification tap (`/gate/:id`). Loads the one
 * entry and opens the decision dialog straight away.
 */
export function GateEntryScreen() {
  const { entryId } = useParams({ strict: false }) as { entryId: string };
  const [dismissed, setDismissed] = useState(false);

  const query = useQuery({
    queryKey: ['gate', 'entry', entryId],
    queryFn: () => living.gate.get(entryId),
    enabled: !!entryId,
  });

  const entry = query.data ?? null;

  return (
    <div>
      <ScreenHeader title="At the gate" subtitle="Delivery" />
      <div className="px-4">
        {query.isLoading ? (
          <Skeleton className="h-32 rounded-card" />
        ) : !entry ? (
          <EmptyState icon={Package} title="Not found" description="This delivery is no longer available." />
        ) : (
          <Card variant="elevated">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-h4 tracking-tight text-strong">
                {entry.vendorName ?? 'Delivery'}
              </p>
              <Badge tone={TONE[entry.status] ?? 'neutral'} size="sm" dot>
                {humanize(entry.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {entry.personName}{entry.mobileNumber ? ` · ${entry.mobileNumber}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-subtle">
              {entry.gate?.name ?? 'Main Gate'} · {formatDateTime(entry.createdAt)}
            </p>
            {entry.photoUrl && (
              <img
                src={entry.photoUrl}
                alt="Taken at the gate"
                className="mt-3 max-h-56 w-full rounded-control object-cover"
              />
            )}
          </Card>
        )}
      </div>

      <GateDecisionDialog
        entry={entry && isPending(entry) && !dismissed ? entry : null}
        onClose={() => { setDismissed(true); void query.refetch(); }}
      />
    </div>
  );
}
