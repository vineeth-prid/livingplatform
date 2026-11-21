import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  CheckCircle2, ClipboardCheck, LifeBuoy, UserPlus, Wrench,
} from 'lucide-react';
import { timeAgo } from '@living/utils';
import { Button, Card, EmptyState, Skeleton, Timeline, type TimelineItem } from '@living/ui';

import { Section } from '../components/section';
import { ViewAllDialog } from '../components/view-all-dialog';
import { groupActivity, type ActivityEvent, type ActivityKind } from '../derive';

const SHOWN = 15;

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

/** Section 4 — recent activity, newest first, grouped Today / Yesterday. The
 *  latest 15 here; "View all" opens every event, searchable by flat number.
 *  Derived from the items already fetched — no timeline API call. */
export function RecentActivity({ events, loading }: { events: ActivityEvent[]; loading: boolean }) {
  const [all, setAll] = useState(false);

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

  if (events.length === 0) {
    return (
      <Section title="Recent activity">
        <EmptyState title="No activity yet" description="Operational events will appear here as they happen." />
      </Section>
    );
  }

  const buckets = groupActivity(events.slice(0, SHOWN));
  return (
    <Section
      title="Recent activity"
      action={events.length > SHOWN ? <Button size="sm" variant="ghost" onClick={() => setAll(true)}>View all ({events.length})</Button> : undefined}
    >
      <Card variant="elevated" className="flex flex-col gap-5">
        {buckets.today.length > 0 && <Group label="Today" events={buckets.today} />}
        {buckets.yesterday.length > 0 && <Group label="Yesterday" events={buckets.yesterday} />}
        {buckets.earlier.length > 0 && <Group label="Earlier" events={buckets.earlier} />}
      </Card>
      <ViewAllDialog
        open={all}
        onOpenChange={setAll}
        title="All recent activity"
        items={events}
        rowKey={(e) => e.id}
        searchText={(e) => `${e.unit ?? ''} ${e.title} ${e.meta ?? ''}`}
        renderItem={(e) => (
          <Link to={e.href} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-sunken">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tint text-brand">{iconFor[e.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-strong">{e.title}</span>
              {e.meta && <span className="block truncate text-xs text-muted">{e.meta}</span>}
            </span>
            <span className="shrink-0 text-xs text-subtle">{timeAgo(e.at)}</span>
          </Link>
        )}
      />
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
