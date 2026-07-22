import { useNavigate } from '@tanstack/react-router';
import { CalendarClock } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import type { MaintenancePlan } from '@living/types';
import { Button, EmptyState, Pagination, Skeleton } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { PriorityPill } from '../operations';
import { RegisterViewToggle, useCardView } from '../shared/register-view';
import { FREQUENCY, frequencyLabel } from './config';
import { NextRunIndicator, PlanStatusBadge } from './maintenance-badges';
import { PlanCard } from './plan-card';
import { useAssetCategoryOptions, useAssetOptions } from './queries';

const DUE = [{ value: 'upcoming', label: 'Upcoming' }, { value: 'overdue', label: 'Overdue' }];
const STATE = [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }];

/** Translate register filters into maintenance-API params. */
function toParams(p: Record<string, unknown>): Record<string, unknown> {
  const { state, due, ...rest } = p;
  if (state === 'active') rest.isActive = true;
  else if (state === 'paused') rest.isActive = false;
  if (due === 'upcoming') rest.upcoming = true;
  else if (due === 'overdue') rest.overdue = true;
  return rest;
}

export function MaintenancePlansPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useCardView('maintenance');
  const assetsQ = useAssetOptions(communityId);
  const categoriesQ = useAssetCategoryOptions(communityId);

  const list = useListQuery<MaintenancePlan>({
    queryKey: ['maintenance-plans', communityId ?? ''],
    basePath: '/maintenance',
    filterKeys: ['assetId', 'categoryId', 'frequencyType', 'state', 'due'],
    defaultSort: 'nextRunAt',
    enabled: !!communityId,
    fetch: (params) => living.maintenance.list({ communityId: communityId!, ...toParams(params) }),
  });

  const columns: ListColumn<MaintenancePlan>[] = [
    { key: 'name', header: 'Plan', sortKey: 'name', cell: (p) => <p className="truncate font-medium text-strong">{p.name}</p> },
    {
      key: 'asset', header: 'Asset', sortKey: 'assetId',
      cell: (p) => p.asset ? (
        <div className="min-w-0"><p className="truncate text-sm text-body">{p.asset.name}</p><p className="font-mono text-xs text-subtle">{p.asset.assetCode}</p></div>
      ) : <span className="text-subtle">—</span>,
    },
    { key: 'frequency', header: 'Frequency', cell: (p) => <span className="text-sm text-body">{frequencyLabel(p.frequencyType, p.frequencyInterval, p.cronExpression)}</span> },
    { key: 'nextRun', header: 'Next run', sortKey: 'nextRunAt', cell: (p) => <NextRunIndicator nextRunAt={p.nextRunAt} isActive={p.isActive} label={p.isActive ? formatDate(p.nextRunAt) : 'Paused'} /> },
    { key: 'lastRun', header: 'Last run', cell: (p) => p.lastRunAt ? <span className="text-sm text-muted">{formatDate(p.lastRunAt)}</span> : <span className="text-subtle">—</span> },
    { key: 'priority', header: 'Priority', sortKey: 'priority', cell: (p) => <PriorityPill priority={p.priority} /> },
    { key: 'status', header: 'Status', cell: (p) => <PlanStatusBadge isActive={p.isActive} /> },
  ];

  const cardBody = (
    <>
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-card" />)}</div>
      ) : list.isEmpty ? (
        <EmptyState icon={CalendarClock} title="No maintenance plans" description="Create a plan to schedule preventive maintenance for an asset."
          action={hasPermission('maintenance:create') ? <Button onClick={() => navigate({ to: '/maintenance/new' })}>New plan</Button> : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.items.map((p) => <PlanCard key={p.id} plan={p} />)}</div>
          {list.meta && list.meta.total > 0 && <Pagination meta={list.meta} onPageChange={list.setPage} />}
        </>
      )}
    </>
  );

  return (
    <ListScaffold
      title="Maintenance plans"
      description="Schedule preventive maintenance — the engine generates work orders when a plan is due."
      query={list}
      columns={columns}
      rowKey={(p) => p.id}
      onRowClick={(p) => navigate({ to: `/maintenance/${p.id}` })}
      searchPlaceholder="Search plans, assets…"
      filters={[
        { key: 'assetId', placeholder: 'All assets', options: (assetsQ.data?.items ?? []).map((a) => ({ value: a.id, label: `${a.assetCode} · ${a.name}` })) },
        { key: 'categoryId', placeholder: 'All categories', options: (categoriesQ.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })) },
        { key: 'frequencyType', placeholder: 'Any frequency', options: opt(FREQUENCY) },
        { key: 'state', placeholder: 'Active & paused', options: STATE },
        { key: 'due', placeholder: 'Any schedule', options: DUE },
      ]}
      createPermission="maintenance:create"
      createLabel="New plan"
      onCreate={() => navigate({ to: '/maintenance/new' })}
      headerActions={<RegisterViewToggle view={view} onChange={setView} />}
      renderContent={view === 'card' ? cardBody : undefined}
    />
  );
}
