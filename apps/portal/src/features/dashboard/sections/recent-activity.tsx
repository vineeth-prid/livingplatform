import { type ReactNode } from 'react';
import {
  CheckCircle2, ClipboardCheck, LifeBuoy, UserPlus, Wrench,
} from 'lucide-react';
import { timeAgo } from '@living/utils';
import { Card, EmptyState, Skeleton, Timeline, type TimelineItem } from '@living/ui';

import { Section } from '../components/section';
import type { ActivityBuckets, ActivityEvent, ActivityKind } from '../derive';

const iconFor: Record<ActivityKind, ReactNode> = {
  'ticket-created': <LifeBuoy className="h-3 w-3" />,
  'ticket-resolved': <CheckCircle2 className="h-3 w-3" />,
  'service-created': <Wrench className="h-3 w-3" />,
  'service-assigned': <Wrench className="h-3 w-3" />,
  'service-completed': <CheckCircle2 className="h-3 w-3" />,
  'work-completed': <ClipboardCheck className="h-3 w-3" />,
  'work-verified': <CheckCircle2 className="h-3 w-3" />,
  'resident-registered': <UserPlus className="h-3 w-3" />,
};

function toItems(events: ActivityEvent[]): TimelineItem[] {
  return events.map((e) => ({
    id: e.id,
    icon: iconFor[e.kind],
    title: e.title,
    meta: e.meta,
    timestamp: timeAgo(e.at),
  }));
}

/** Section 4 — recent activity, newest first, grouped Today / Yesterday.
 *  Reuses the shared Timeline component; no timeline API call (derived from
 *  the items already fetched). */
export function RecentActivity({ buckets, loading }: { buckets: ActivityBuckets; loading: boolean }) {
  if (loading) {
    return (
      <Section title="Recent activity">
        <Card variant="elevated" className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </Card>
      </Section>
    );
  }

  const isEmpty =
    buckets.today.length + buckets.yesterday.length + buckets.earlier.length === 0;
  if (isEmpty) {
    return (
      <Section title="Recent activity">
        <EmptyState title="No activity yet" description="Operational events will appear here as they happen." />
      </Section>
    );
  }

  return (
    <Section title="Recent activity">
      <Card variant="elevated" className="flex flex-col gap-5">
        {buckets.today.length > 0 && <Group label="Today" events={buckets.today} />}
        {buckets.yesterday.length > 0 && <Group label="Yesterday" events={buckets.yesterday} />}
        {buckets.earlier.length > 0 && <Group label="Earlier" events={buckets.earlier} />}
      </Card>
    </Section>
  );
}

function Group({ label, events }: { label: string; events: ActivityEvent[] }) {
  return (
    <div>
      <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</p>
      <Timeline items={toItems(events)} />
    </div>
  );
}
