import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Inbox, LifeBuoy, Wrench } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Skeleton } from '@living/ui';

import { Section } from '../components/section';
import { ViewAllDialog } from '../components/view-all-dialog';
import type { MyWork as MyWorkData } from '../derive';

const SHOWN = 15;

interface WorkRow {
  key: string;
  to: string;
  icon: ReactNode;
  primary: string;
  secondary: string;
  badge: ReactNode;
  search: string;
}

function Row({ row }: { row: WorkRow }) {
  return (
    <Link
      to={row.to}
      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:shadow-ring"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tint text-brand">{row.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-strong">{row.primary}</p>
        <p className="truncate text-xs text-muted">{row.secondary}</p>
      </div>
      {row.badge}
    </Link>
  );
}

/** "A-101 · TKT-000009 · raised by you" — the flat leads. */
const where = (unit: string | null | undefined, rest: string) => (unit ? `${unit} · ${rest}` : rest);

function rowsOf(work: MyWorkData): WorkRow[] {
  return [
    ...work.awaitingMyVerification.map((w) => ({
      key: `w-${w.id}`, to: '/work-orders', icon: <CheckCircle2 className="h-4 w-4" />, primary: w.title,
      secondary: where(w.unit?.unitNumber, `${w.workOrderNumber} · awaiting your verification`),
      badge: <Badge tone="warning" size="sm" dot>Verify</Badge>,
      search: `${w.unit?.unitNumber ?? ''} ${w.workOrderNumber} ${w.title}`,
    })),
    ...work.raisedTickets.map((t) => ({
      key: `t-${t.id}`, to: '/tickets', icon: <LifeBuoy className="h-4 w-4" />, primary: t.title,
      secondary: where(t.unit?.unitNumber, `${t.ticketNumber} · raised by you`),
      badge: <Badge tone="neutral" size="sm">{t.status.replace('_', ' ').toLowerCase()}</Badge>,
      search: `${t.unit?.unitNumber ?? ''} ${t.ticketNumber} ${t.title}`,
    })),
    ...work.requestedServices.map((r) => ({
      key: `s-${r.id}`, to: '/service-requests', icon: <Wrench className="h-4 w-4" />, primary: r.title,
      secondary: where(r.unit?.unitNumber, `${r.requestNumber} · your request`),
      badge: <Badge tone="info" size="sm">{r.status.replace('_', ' ').toLowerCase()}</Badge>,
      search: `${r.unit?.unitNumber ?? ''} ${r.requestNumber} ${r.title}`,
    })),
  ];
}

/** Section 6 — the signed-in user's items and next actions: the first 15 here,
 *  "View all" opens the rest, searchable by flat number. */
export function MyWork({ work, loading }: { work: MyWorkData; loading: boolean }) {
  const [all, setAll] = useState(false);

  if (loading) {
    return (
      <Section title="My work">
        <Card variant="elevated" className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </Card>
      </Section>
    );
  }

  const rows = rowsOf(work);
  if (rows.length === 0) {
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
    <Section
      title="My work"
      action={rows.length > SHOWN ? <Button size="sm" variant="ghost" onClick={() => setAll(true)}>View all ({rows.length})</Button> : undefined}
    >
      <Card variant="elevated" className="flex flex-col gap-1">
        {rows.slice(0, SHOWN).map((r) => <Row key={r.key} row={r} />)}
      </Card>
      <ViewAllDialog
        open={all}
        onOpenChange={setAll}
        title="All my work"
        items={rows}
        rowKey={(r) => r.key}
        searchText={(r) => r.search}
        renderItem={(r) => <Row row={r} />}
      />
    </Section>
  );
}
