import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { timeAgo } from '@living/utils';
import { Button, EmptyState, SearchInput, Skeleton } from '@living/ui';
import { cn } from '@living/utils';

import { useMyRequests, type RequestKind } from '../queries';
import { CreateRequestSheet } from '../create-request-sheet';
import { ListCard, StatusPill } from '../components';
import { ScreenHeader } from '../shell';

type Filter = 'all' | RequestKind;

export function RequestsScreen() {
  const { items, isLoading } = useMyRequests();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [complaint, setComplaint] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((r) =>
      (filter === 'all' || r.kind === filter) &&
      (!needle || r.title.toLowerCase().includes(needle) || r.number.toLowerCase().includes(needle)),
    );
  }, [items, q, filter]);

  return (
    <div>
      <ScreenHeader title="My requests" subtitle="Living"
        right={<Button size="sm" onClick={() => setComplaint(true)}><Plus className="h-4 w-4" /> New</Button>} />

      <div className="flex flex-col gap-3 px-4">
        <SearchInput value={q} onValueChange={setQ} placeholder="Search your requests…" />
        <div className="flex gap-1.5">
          {([['all', 'All'], ['ticket', 'Complaints'], ['service', 'Services']] as const).map(([v, label]) => (
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
              subtitle={`${r.number} · ${r.kind === 'ticket' ? 'Complaint' : 'Service'} · ${timeAgo(r.createdAt)}`}
              trailing={<StatusPill status={r.status} />} />
          ))
        )}
      </div>

      <CreateRequestSheet open={complaint} onOpenChange={setComplaint} mode="complaint" />
    </div>
  );
}
