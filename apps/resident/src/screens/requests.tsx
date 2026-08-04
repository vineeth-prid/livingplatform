import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { timeAgo } from '@living/utils';
import { Button, EmptyState, SearchInput, Skeleton } from '@living/ui';
import { cn } from '@living/utils';

import { useMyRequests, type MyRequest, type RequestKind } from '../queries';
import { useMyVisitors } from '../community-ops';
import { CreateRequestSheet } from '../create-request-sheet';
import { ListCard, StatusPill } from '../components';
import { ScreenHeader } from '../shell';

type Filter = 'all' | RequestKind;

const KIND_LABEL: Record<RequestKind, string> = {
  ticket: 'Complaint',
  service: 'Service',
  visitor: 'Visitor',
};

/**
 * Everything the resident has asked the community for, in one place:
 * complaints, service requests and visitor passes. They are separate engines
 * on the backend, but to a resident they are all "things I raised", so they
 * live under one screen with one filter row.
 */
export function RequestsScreen() {
  const { items: workItems, isLoading } = useMyRequests();
  const visitors = useMyVisitors();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [complaint, setComplaint] = useState(false);

  // Visitors are folded into the same shape rather than given their own list —
  // one sorted timeline reads better than three.
  const items = useMemo<MyRequest[]>(() => {
    const visitorItems: MyRequest[] = (visitors.data?.items ?? []).map((v) => ({
      kind: 'visitor' as const,
      id: v.id,
      number: v.passCode,
      title: v.visitorName,
      status: v.status,
      createdAt: v.createdAt,
      detailPath: '/visitors',
    }));
    return [...workItems, ...visitorItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [workItems, visitors.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (r) =>
        (filter === 'all' || r.kind === filter) &&
        (!needle ||
          r.title.toLowerCase().includes(needle) ||
          r.number.toLowerCase().includes(needle)),
    );
  }, [items, q, filter]);

  return (
    <div>
      {/* "New" raises a complaint. Under the Services or Visitors filter that is
          the wrong action — those are booked from their own screens — so it is
          disabled rather than quietly opening the complaint sheet. */}
      <ScreenHeader title="My requests" subtitle="Living"
        right={
          <Button
            size="sm"
            disabled={filter === 'service' || filter === 'visitor'}
            onClick={() => setComplaint(true)}
          >
            <Plus className="h-4 w-4" /> New
          </Button>
        } />

      <div className="flex flex-col gap-3 px-4">
        <SearchInput value={q} onValueChange={setQ} placeholder="Search your requests…" />
        <div className="flex gap-1.5">
          {([['all', 'All'], ['ticket', 'Complaints'], ['service', 'Services'], ['visitor', 'Visitors']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={cn('rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                filter === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 px-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-card" />)
        ) : filtered.length === 0 ? (
          <EmptyState title="No requests" description="Raise a complaint or book a service to get started." />
        ) : (
          filtered.map((r) => (
            <ListCard key={r.id} to={r.detailPath}
              title={r.title}
              subtitle={`${r.number} · ${KIND_LABEL[r.kind]} · ${timeAgo(r.createdAt)}`}
              trailing={<StatusPill status={r.status} />} />
          ))
        )}
      </div>

      <CreateRequestSheet open={complaint} onOpenChange={setComplaint} mode="complaint" />
    </div>
  );
}
