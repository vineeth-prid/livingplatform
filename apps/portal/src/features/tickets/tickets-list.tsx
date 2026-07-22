import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { KanbanSquare, Table2 } from 'lucide-react';
import { cn } from '@living/utils';
import type { Ticket } from '@living/types';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { PriorityBadge, TicketStatusBadge } from './ticket-badges';
import { TicketForm } from './ticket-form';
import { TicketKanban } from './ticket-kanban';
import { useTicketCategories } from './queries';

type ViewMode = 'table' | 'kanban';
const VIEW_KEY = 'living.tickets.view';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const;

const columns: ListColumn<Ticket>[] = [
  { key: 'number', header: 'Ticket', sortKey: 'number', cell: (t) => <span className="font-mono text-sm font-medium text-strong">{t.ticketNumber}</span> },
  {
    key: 'title', header: 'Title',
    cell: (t) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-strong">{t.title}</p>
        <p className="text-xs text-subtle">{t.category?.name}{t.unit?.unitNumber ? ` · ${t.unit.unitNumber}` : ''}</p>
      </div>
    ),
  },
  { key: 'priority', header: 'Priority', sortKey: 'priority', cell: (t) => <PriorityBadge priority={t.priority} /> },
  { key: 'status', header: 'Status', sortKey: 'status', cell: (t) => <TicketStatusBadge status={t.status} /> },
];

export function TicketsListPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();
  const categories = useTicketCategories();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<ViewMode>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem(VIEW_KEY) as ViewMode)) || 'table',
  );
  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

  const list = useListQuery<Ticket>({
    queryKey: qk.tickets(communityId ?? '', 'list'),
    basePath: '/tickets',
    filterKeys: ['status', 'priority', 'categoryId'],
    defaultSort: 'createdAt',
    enabled: !!communityId && view === 'table',
    fetch: (params) => living.ticket.list(communityId!, params),
  });

  // Kanban shares the same URL filters, fetches a wider set, groups by status.
  const kanban = useQuery({
    queryKey: [...qk.tickets(communityId ?? '', 'kanban'), list.q, list.filters],
    queryFn: () => living.ticket.list(communityId!, {
      limit: 100, sortBy: 'createdAt', sortDir: 'desc',
      ...(list.q ? { search: list.q } : {}), ...list.filters,
    }),
    enabled: !!communityId && view === 'kanban',
  });

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <ListScaffold
        title="Tickets"
        description="Triage, assign and track operational issues."
        query={list}
        columns={columns}
        rowKey={(t) => t.id}
        onRowClick={(t) => navigate({ to: `/tickets/${t.id}` })}
        searchPlaceholder="Search ticket #, title, unit, resident…"
        filters={[
          { key: 'status', placeholder: 'All statuses', options: opt(STATUSES) },
          { key: 'priority', placeholder: 'All priorities', options: opt(PRIORITIES) },
          ...(categoryOptions.length ? [{ key: 'categoryId', placeholder: 'All categories', options: categoryOptions }] : []),
        ]}
        createPermission="ticket:create"
        createLabel="Raise ticket"
        onCreate={() => setCreating(true)}
        headerActions={<ViewToggle view={view} onChange={setView} />}
        renderContent={
          view === 'kanban'
            ? <TicketKanban tickets={kanban.data?.items ?? []} loading={kanban.isLoading} />
            : undefined
        }
      />
      {communityId && (
        <TicketForm open={creating} onOpenChange={setCreating} communityId={communityId} onSaved={() => list.refetch()} />
      )}
    </>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex items-center gap-0.5 rounded-pill bg-sunken p-0.5">
      {([['table', Table2, 'Table'], ['kanban', KanbanSquare, 'Kanban']] as const).map(([v, Icon, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={view === v}
          aria-label={label}
          onClick={() => onChange(v)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            view === v ? 'bg-card text-strong shadow-xs' : 'text-subtle hover:text-body',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
