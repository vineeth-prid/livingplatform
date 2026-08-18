import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { formatDateTime } from '@living/utils';
import type { GateEntry } from '@living/living-sdk';
import { EmptyState, Pagination, Skeleton } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { RegisterViewToggle, useCardView } from '../shared/register-view';
import { VISITOR_STATUS, VisitorStatusBadge, useResidentOptions, useUnitOptions } from './lib';
import { VisitorActions } from './visitor-actions';
import { VisitorForm } from './visitor-form';

/**
 * The visitor register — VISITOR gate entries.
 *
 * Same records the security console works from, so an invitation a resident
 * raised appears here the moment it exists and a decision made in either place
 * is immediately true in the other. Previously this page read a separate table
 * the gate never saw.
 */
const residentName = (v: GateEntry) => (v.resident ? `${v.resident.firstName} ${v.resident.lastName}` : '—');
const whenExpected = (v: GateEntry) => formatDateTime(v.expectedArrival ?? v.createdAt);

function toParams(p: Record<string, unknown>): Record<string, unknown> {
  const { date, ...rest } = p;
  if (typeof date === 'string' && date) {
    rest.dateFrom = new Date(date + 'T00:00:00').toISOString();
    rest.dateTo = new Date(date + 'T23:59:59').toISOString();
  }
  return rest;
}

export function VisitorsPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useCardView('visitors');
  const [creating, setCreating] = useState(false);
  const residentsQ = useResidentOptions(communityId);
  const unitsQ = useUnitOptions(communityId);

  const list = useListQuery<GateEntry>({
    queryKey: ['gate-entries', 'visitors', communityId ?? ''],
    basePath: '/visitors',
    filterKeys: ['status', 'residentId', 'date'],
    defaultSort: 'createdAt',
    enabled: !!communityId,
    // entryType pins the register to visitors; deliveries have their own page.
    fetch: (params) => living.gate.list(communityId!, { entryType: 'VISITOR', ...toParams(params) }),
  });

  const columns: ListColumn<GateEntry>[] = [
    {
      key: 'passCode', header: 'Pass',
      cell: (v) => <span className="font-mono text-sm font-semibold tracking-wide text-brand">{v.passCode ?? '—'}</span>,
    },
    {
      key: 'visitor', header: 'Visitor', sortKey: 'personName',
      cell: (v) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{v.personName}</p>
          <p className="truncate text-xs text-subtle">{v.mobileNumber ?? v.entryNumber}</p>
        </div>
      ),
    },
    {
      key: 'unit', header: 'Unit',
      cell: (v) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-body" data-numeric>{v.unit?.unitNumber ?? '—'}</p>
          <p className="truncate text-xs text-subtle">{residentName(v)}</p>
        </div>
      ),
    },
    { key: 'arrival', header: 'Expected', cell: (v) => <span className="text-sm text-muted">{whenExpected(v)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (v) => <VisitorStatusBadge status={v.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      cell: (v) => <div onClick={(e) => e.stopPropagation()}><VisitorActions visitor={v} onDone={() => list.refetch()} /></div>,
    },
  ];

  const cards = (
    <>
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-card" />)}
        </div>
      ) : list.isEmpty ? (
        <EmptyState icon={UserRound} title="No visitors" description="Visitor invitations will appear here." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate({ to: `/gate/${v.id}` })}
                className="flex flex-col gap-3 rounded-card border border-border-subtle bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-brand">{v.passCode ?? v.entryNumber}</span>
                  <VisitorStatusBadge status={v.status} />
                </div>
                <div>
                  <p className="font-medium text-strong">{v.personName}</p>
                  <p className="text-xs text-muted">
                    {v.unit?.unitNumber ?? '—'} · {residentName(v)} · {whenExpected(v)}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <VisitorActions visitor={v} onDone={() => list.refetch()} />
                </div>
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
        description="Approve, track and close out everyone visiting the community."
        query={list}
        columns={columns}
        rowKey={(v) => v.id}
        // The gate entry detail page — one record, one place to read it.
        onRowClick={(v) => navigate({ to: `/gate/${v.id}` })}
        searchPlaceholder="Search name, mobile, pass code…"
        filters={[
          { key: 'status', placeholder: 'All statuses', options: opt(VISITOR_STATUS) },
          {
            key: 'residentId', placeholder: 'All residents',
            options: (residentsQ.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` })),
          },
        ]}
        createPermission="gate:entry:create"
        createLabel="Invite visitor"
        onCreate={() => setCreating(true)}
        headerActions={<RegisterViewToggle view={view} onChange={setView} />}
        renderContent={view === 'card' ? cards : undefined}
      />
      {communityId && hasPermission('gate:entry:create') && (
        <VisitorForm
          open={creating}
          onOpenChange={setCreating}
          communityId={communityId}
          units={(unitsQ.data?.items ?? []).map((u) => ({ value: u.id, label: u.unitNumber }))}
          onSaved={() => list.refetch()}
        />
      )}
    </>
  );
}
