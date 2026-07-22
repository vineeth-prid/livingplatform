import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { formatDateTime } from '@living/utils';
import type { Visitor } from '@living/types';
import { EmptyState, Pagination, Skeleton } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { RegisterViewToggle, useCardView } from '../shared/register-view';
import { VISITOR_STATUS, VISITOR_TYPE, VisitorStatusBadge, VisitorTypeBadge, useResidentOptions } from './lib';
import { VisitorActions } from './visitor-actions';
import { VisitorForm } from './visitor-form';

const residentName = (v: Visitor) => v.resident ? `${v.resident.firstName} ${v.resident.lastName}` : '—';

function toParams(p: Record<string, unknown>): Record<string, unknown> {
  const { date, ...rest } = p;
  if (typeof date === 'string' && date) { rest.dateFrom = new Date(date + 'T00:00:00').toISOString(); rest.dateTo = new Date(date + 'T23:59:59').toISOString(); }
  return rest;
}

export function VisitorsPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useCardView('visitors');
  const [creating, setCreating] = useState(false);
  const residentsQ = useResidentOptions(communityId);

  const list = useListQuery<Visitor>({
    queryKey: ['visitors', communityId ?? ''],
    basePath: '/visitors',
    filterKeys: ['status', 'visitorType', 'residentId', 'date'],
    defaultSort: 'expectedArrival',
    enabled: !!communityId,
    fetch: (params) => living.visitors.list({ communityId: communityId!, ...toParams(params) }),
  });

  const columns: ListColumn<Visitor>[] = [
    { key: 'passCode', header: 'Pass', cell: (v) => <span className="font-mono text-sm font-semibold tracking-wide text-brand">{v.passCode}</span> },
    { key: 'visitor', header: 'Visitor', sortKey: 'expectedArrival', cell: (v) => <div className="min-w-0"><p className="truncate font-medium text-strong">{v.visitorName}</p><p className="truncate text-xs text-subtle">{v.mobileNumber}</p></div> },
    { key: 'resident', header: 'Resident', cell: (v) => <span className="text-sm text-body">{residentName(v)}</span> },
    { key: 'type', header: 'Type', cell: (v) => <VisitorTypeBadge type={v.visitorType} /> },
    { key: 'arrival', header: 'Expected', cell: (v) => <span className="text-sm text-muted">{formatDateTime(v.expectedArrival)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (v) => <VisitorStatusBadge status={v.status} /> },
    { key: 'actions', header: '', align: 'right', cell: (v) => <div onClick={(e) => e.stopPropagation()}><VisitorActions visitor={v} onDone={() => list.refetch()} /></div> },
  ];

  const cards = (
    <>
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-card" />)}</div>
      ) : list.isEmpty ? (
        <EmptyState icon={UserRound} title="No visitors" description="Visitor invitations will appear here." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((v) => (
              <button key={v.id} onClick={() => navigate({ to: `/visitors/${v.id}` })} className="flex flex-col gap-3 rounded-card border border-border-subtle bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between"><span className="font-mono text-sm font-semibold text-brand">{v.passCode}</span><VisitorStatusBadge status={v.status} /></div>
                <div><p className="font-medium text-strong">{v.visitorName}</p><p className="text-xs text-muted">{residentName(v)} · {formatDateTime(v.expectedArrival)}</p></div>
                <div onClick={(e) => e.stopPropagation()}><VisitorActions visitor={v} onDone={() => list.refetch()} /></div>
              </button>
            ))}
          </div>
          {list.meta && list.meta.total > 0 && <Pagination meta={list.meta} onPageChange={list.setPage} />}
        </>
      )}
    </>
  );

  return (
    <>
      <ListScaffold
        title="Visitors"
        description="Approve, check in and track everyone entering the community."
        query={list}
        columns={columns}
        rowKey={(v) => v.id}
        onRowClick={(v) => navigate({ to: `/visitors/${v.id}` })}
        searchPlaceholder="Search name, mobile, pass code…"
        filters={[
          { key: 'status', placeholder: 'All statuses', options: opt(VISITOR_STATUS) },
          { key: 'visitorType', placeholder: 'All types', options: opt(VISITOR_TYPE) },
          { key: 'residentId', placeholder: 'All residents', options: (residentsQ.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` })) },
        ]}
        createPermission="visitor:create"
        createLabel="Invite visitor"
        onCreate={() => setCreating(true)}
        headerActions={<RegisterViewToggle view={view} onChange={setView} />}
        renderContent={view === 'card' ? cards : undefined}
      />
      {communityId && hasPermission('visitor:create') && (
        <VisitorForm open={creating} onOpenChange={setCreating} communityId={communityId} residents={(residentsQ.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` }))} onSaved={() => list.refetch()} />
      )}
    </>
  );
}
