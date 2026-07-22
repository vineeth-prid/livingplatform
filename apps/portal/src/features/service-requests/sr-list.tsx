import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type { ServiceRequest } from '@living/types';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import {
  OperationsKanban, PriorityPill, StatusPill, ViewToggle, useViewMode,
} from '../operations';
import { SR_KANBAN, SR_STATUSES, SR_TONES, srWorkflow } from './config';
import { ServiceRequestForm } from './sr-form';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const columns: ListColumn<ServiceRequest>[] = [
  { key: 'number', header: 'Request', sortKey: 'number', cell: (r) => <span className="font-mono text-sm font-medium text-strong">{r.requestNumber}</span> },
  {
    key: 'title', header: 'Title',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-strong">{r.title}</p>
        <p className="text-xs text-subtle">{r.service?.name}{r.unit?.unitNumber ? ` · ${r.unit.unitNumber}` : ''}</p>
      </div>
    ),
  },
  { key: 'priority', header: 'Priority', sortKey: 'priority', cell: (r) => <PriorityPill priority={r.priority} /> },
  { key: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusPill status={r.status} tones={SR_TONES} /> },
];

export function ServiceRequestsListPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useViewMode('service-requests');

  const list = useListQuery<ServiceRequest>({
    queryKey: qk.serviceRequests(communityId ?? '', 'list'),
    basePath: '/service-requests',
    filterKeys: ['status', 'priority'],
    defaultSort: 'createdAt',
    enabled: !!communityId && view === 'table',
    fetch: (params) => living.serviceRequest.list(communityId!, params),
  });

  const kanban = useQuery({
    queryKey: [...qk.serviceRequests(communityId ?? '', 'kanban'), list.q, list.filters],
    queryFn: () => living.serviceRequest.list(communityId!, {
      limit: 100, sortBy: 'createdAt', sortDir: 'desc', ...(list.q ? { search: list.q } : {}), ...list.filters }),
    enabled: !!communityId && view === 'kanban',
  });

  return (
    <>
      <ListScaffold
        title="Service requests"
        description="Planned work requested by residents and staff."
        query={list}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: `/service-requests/${r.id}` })}
        searchPlaceholder="Search request #, title, unit, resident…"
        filters={[
          { key: 'status', placeholder: 'All statuses', options: opt(SR_STATUSES) },
          { key: 'priority', placeholder: 'All priorities', options: opt(PRIORITIES) },
        ]}
        createPermission="service:create"
        createLabel="New request"
        onCreate={() => setCreating(true)}
        headerActions={<ViewToggle view={view} onChange={setView} />}
        renderContent={view === 'kanban' ? (
          <OperationsKanban
            items={(kanban.data?.items ?? []).map((r) => ({
              id: r.id, status: r.status, number: r.requestNumber, title: r.title,
              priority: r.priority, subtitle: r.unit?.unitNumber, createdAt: r.createdAt,
            }))}
            columns={[...SR_KANBAN]}
            workflow={srWorkflow}
            loading={kanban.isLoading}
            basePath="/service-requests"
            changeStatus={(id, to) => living.serviceRequest.changeStatus(id, to)}
            renderPriority={(p) => <PriorityPill priority={p} />}
            invalidateKey={['service-requests']}
          />
        ) : undefined}
      />
      {communityId && (
        <ServiceRequestForm open={creating} onOpenChange={setCreating} communityId={communityId} onSaved={() => list.refetch()} />
      )}
    </>
  );
}
