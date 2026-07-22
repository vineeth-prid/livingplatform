import { History } from 'lucide-react';
import { formatDateTime, timeAgo } from '@living/utils';
import { EmptyState, Skeleton, Timeline, type TimelineItem } from '@living/ui';

import { useAssetEvents } from './queries';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const actor = (id?: string | null) => (id ? (id.startsWith('system') ? 'System' : id) : 'System');

/** History tab — the asset's structured event log as a timeline, newest first. */
export function AssetHistory({ assetId }: { assetId: string }) {
  const q = useAssetEvents(assetId);
  if (q.isLoading) return <Skeleton className="h-24" />;
  const events = [...(q.data ?? [])].reverse();
  if (events.length === 0) return <EmptyState icon={History} title="No history yet" description="Changes to this asset will appear here." />;
  const items: TimelineItem[] = events.map((e) => ({
    id: e.id,
    title: humanize(e.eventType),
    timestamp: timeAgo(e.createdAt),
  }));
  return <Timeline items={items} />;
}

/** Events tab — a detailed table of asset events (type, date, description, user). */
export function AssetEventsList({ assetId }: { assetId: string }) {
  const q = useAssetEvents(assetId);
  if (q.isLoading) return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  const events = [...(q.data ?? [])].reverse();
  if (events.length === 0) return <EmptyState icon={History} title="No events" description="Asset events (created, updated, lifecycle) will show here." />;

  return (
    <ul className="flex flex-col divide-y divide-border-subtle rounded-card border border-border-subtle">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3 px-3.5 py-3">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-strong">{humanize(e.eventType)}</p>
              <span className="text-xs text-subtle" title={formatDateTime(e.createdAt)}>{timeAgo(e.createdAt)}</span>
            </div>
            {e.description && <p className="mt-0.5 text-sm text-body">{e.description}</p>}
            <p className="mt-0.5 text-2xs uppercase tracking-wider text-subtle">by {actor(e.performedById)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
