import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, ClipboardCheck, Inbox, LifeBuoy, Wrench } from 'lucide-react';
import { Badge, Card, EmptyState, Skeleton } from '@living/ui';
import type { Ticket, ServiceRequest, WorkOrder } from '@living/types';

import { Section } from '../components/section';
import type { MyWork as MyWorkData } from '../derive';

function Row({ icon, primary, secondary, badge, to }: {
  icon: ReactNode; primary: string; secondary?: string; badge?: ReactNode; to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:shadow-ring"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tint text-brand">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-strong">{primary}</p>
        {secondary && <p className="truncate text-xs text-muted">{secondary}</p>}
      </div>
      {badge}
    </Link>
  );
}

/** Section 6 — the signed-in user's items and next actions. Empty state when
 *  there's nothing on their plate. */
export function MyWork({ work, loading }: { work: MyWorkData; loading: boolean }) {
  if (loading) {
    return (
      <Section title="My work">
        <Card variant="elevated" className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </Card>
      </Section>
    );
  }

  const total =
    work.raisedTickets.length + work.requestedServices.length + work.awaitingMyVerification.length;
  if (total === 0) {
    return (
      <Section title="My work">
        <EmptyState
          icon={Inbox}
          title="You’re all caught up"
          description="Items you raise or need to verify will show up here."
        />
      </Section>
    );
  }

  return (
    <Section title="My work">
      <Card variant="elevated" className="flex flex-col gap-1">
        {work.awaitingMyVerification.map((w: WorkOrder) => (
          <Row
            key={w.id}
            to="/work-orders"
            icon={<CheckCircle2 className="h-4 w-4" />}
            primary={w.title}
            secondary={`${w.workOrderNumber} · awaiting your verification`}
            badge={<Badge tone="warning" size="sm" dot>Verify</Badge>}
          />
        ))}
        {work.raisedTickets.map((t: Ticket) => (
          <Row
            key={t.id}
            to="/tickets"
            icon={<LifeBuoy className="h-4 w-4" />}
            primary={t.title}
            secondary={`${t.ticketNumber} · raised by you`}
            badge={<Badge tone="neutral" size="sm">{t.status.replace('_', ' ').toLowerCase()}</Badge>}
          />
        ))}
        {work.requestedServices.map((r: ServiceRequest) => (
          <Row
            key={r.id}
            to="/service-requests"
            icon={<Wrench className="h-4 w-4" />}
            primary={r.title}
            secondary={`${r.requestNumber} · your request`}
            badge={<Badge tone="info" size="sm">{r.status.replace('_', ' ').toLowerCase()}</Badge>}
          />
        ))}
      </Card>
    </Section>
  );
}
