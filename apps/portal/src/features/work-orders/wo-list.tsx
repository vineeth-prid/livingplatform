import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type { WorkOrder } from '@living/types';

import { Badge } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { OperationsKanban, PriorityPill, StatusPill, ViewToggle, useViewMode } from '../operations';
import { WO_KANBAN, WO_ORIGIN_LABEL, WO_ORIGIN_TONES, WO_ORIGINS, WO_STATUSES, WO_TONES, woWorkflow } from './config';
import { WorkOrderForm } from './wo-form';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const columns: ListColumn<WorkOrder>[] = [
  { key: 'number', header: 'Work order', sortKey: 'number', cell: (w) => <span className="font-mono text-sm font-medium text-strong">{w.workOrderNumber}</span> },
  {
    key: 'title', header: 'Title',
    cell: (w) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-strong">{w.title}</p>
        <p className="text-xs text-subtle">{w.unit?.unitNumber ? `Unit ${w.unit.unitNumber}` : 'Common area'}</p>
      </div>
    ),
  },
  {
    key: 'origin', header: 'Origin',
    cell: (w) => <Badge tone={WO_ORIGIN_TONES[w.originType] ?? 'neutral'} size="sm">{WO_ORIGIN_LABEL[w.originType] ?? w.originType}</Badge>,
  },
  { key: 'priority', header: 'Priority', sortKey: 'priority', cell: (w) => <PriorityPill priority={w.priority} /> },
  { key: 'status', header: 'Status', sortKey: 'status', cell: (w) => <StatusPill status={w.status} tones={WO_TONES} /> },
];

export function WorkOrdersListPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useViewMode('work-orders');

  const list = useListQuery<WorkOrder>({
    queryKey: qk.workOrders(communityId ?? '', 'list'),
    basePath: '/work-orders',
    filterKeys: ['status', 'priority', 'originType'],
    defaultSort: 'createdAt',
    enabled: !!communityId && view === 'table',
    fetch: (params) => living.workOrder.list(communityId!, params),
  });

  const kanban = useQuery({
    queryKey: [...qk.workOrders(communityId ?? '', 'kanban'), list.q, list.filters],
    queryFn: () => living.workOrder.list(communityId!, {
      limit: 100, sortBy: 'createdAt', sortDir: 'desc', ...(list.q ? { search: list.q } : {}), ...list.filters }),
    enabled: !!communityId && view === 'kanban',
  });

  return (
    <>
      <ListScaffold
        title="Work orders"
        description="Track approved operational work generated from Tickets, Maintenance Plans, AMC Contracts or Emergency Requests."
        query={list}
        columns={columns}
        rowKey={(w) => w.id}
        onRowClick={(w) => navigate({ to: `/work-orders/${w.id}` })}
        searchPlaceholder="Search work order #, title, unit…"
        filters={[
          { key: 'status', placeholder: 'All statuses', options: opt(WO_STATUSES) },
          { key: 'priority', placeholder: 'All priorities', options: opt(PRIORITIES) },
          { key: 'originType', placeholder: 'All origins', options: WO_ORIGINS.map((o) => ({ value: o, label: WO_ORIGIN_LABEL[o] ?? o })) },
        ]}
        createPermission="workorder:create"
        createLabel="Manual work order"
        onCreate={() => setCreating(true)}
        headerActions={<ViewToggle view={view} onChange={setView} />}
        renderContent={view === 'kanban' ? (
          <OperationsKanban
            items={(kanban.data?.items ?? []).map((w) => ({
              id: w.id, status: w.status, number: w.workOrderNumber, title: w.title,
              priority: w.priority, subtitle: w.unit?.unitNumber ?? 'Common area', createdAt: w.createdAt,
            }))}
            columns={[...WO_KANBAN]}
            workflow={woWorkflow}
            loading={kanban.isLoading}
            basePath="/work-orders"
            changeStatus={(id, to) => living.workOrder.changeStatus(id, to)}
            renderPriority={(p) => <PriorityPill priority={p} />}
            invalidateKey={['work-orders']}
          />
        ) : undefined}
      />
      {communityId && (
        <WorkOrderForm open={creating} onOpenChange={setCreating} communityId={communityId} onSaved={() => list.refetch()} />
      )}
    </>
  );
}
