import { useNavigate } from '@tanstack/react-router';
import { FileSignature, Package } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import type { AMCContract } from '@living/types';
import { Button, EmptyState, Pagination, Skeleton } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { RegisterViewToggle, useCardView } from '../shared/register-view';
import { COVERAGE_TYPE, formatMoney } from './config';
import { AmcStatusBadge, RenewalIndicator } from './amc-badges';
import { ContractCard } from './contract-card';
import { useVendorOptions } from './queries';

const EXPIRY = [{ value: '30', label: 'Expiring ≤ 30 days' }, { value: '60', label: 'Expiring ≤ 60 days' }, { value: '90', label: 'Expiring ≤ 90 days' }];
const RENEWAL = [{ value: 'true', label: 'Renewal due' }];

function toParams(p: Record<string, unknown>): Record<string, unknown> {
  const { renewalDue, expiry, ...rest } = p;
  if (renewalDue === 'true') rest.renewalDue = true;
  if (typeof expiry === 'string' && expiry) rest.expiringBefore = new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000).toISOString();
  return rest;
}

export function AmcContractsPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useCardView('amc');
  const vendorsQ = useVendorOptions(!!communityId);

  const list = useListQuery<AMCContract>({
    queryKey: ['amc-contracts', communityId ?? ''],
    basePath: '/amc',
    filterKeys: ['vendorId', 'status', 'coverageType', 'renewalDue', 'expiry'],
    defaultSort: 'endDate',
    enabled: !!communityId,
    fetch: (params) => living.amc.list({ communityId: communityId!, ...toParams(params) }),
  });

  const columns: ListColumn<AMCContract>[] = [
    {
      key: 'contract', header: 'Contract', sortKey: 'name',
      cell: (c) => <div className="min-w-0"><p className="truncate font-medium text-strong">{c.name}</p><p className="font-mono text-xs text-subtle">{c.contractNumber}</p></div>,
    },
    { key: 'vendor', header: 'Vendor', sortKey: 'vendorId', cell: (c) => <span className="text-sm text-body">{c.vendor?.name ?? '—'}</span> },
    { key: 'status', header: 'Status', cell: (c) => <AmcStatusBadge status={c.status} /> },
    { key: 'start', header: 'Start', cell: (c) => <span className="text-sm text-muted">{formatDate(c.startDate)}</span> },
    { key: 'expiry', header: 'Expiry', sortKey: 'endDate', cell: (c) => <div className="flex flex-col"><span className="text-sm text-body">{formatDate(c.endDate)}</span><RenewalIndicator status={c.status} endDate={c.endDate} showLabel={false} /></div> },
    { key: 'cost', header: 'Annual cost', sortKey: 'annualCost', cell: (c) => <span className="text-sm font-medium text-strong">{formatMoney(c.annualCost, c.currency)}</span> },
    { key: 'covered', header: 'Assets', align: 'right', cell: (c) => <span className="inline-flex items-center gap-1 text-sm text-muted"><Package className="h-3.5 w-3.5" /> {c._count?.coverages ?? 0}</span> },
  ];

  const cardBody = (
    <>
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-card" />)}</div>
      ) : list.isEmpty ? (
        <EmptyState icon={FileSignature} title="No AMC contracts" description="Record a maintenance contract with a vendor to track coverage, SLA and renewals."
          action={hasPermission('amc:create') ? <Button onClick={() => navigate({ to: '/amc/new' })}>New contract</Button> : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.items.map((c) => <ContractCard key={c.id} contract={c} />)}</div>
          {list.meta && list.meta.total > 0 && <Pagination meta={list.meta} onPageChange={list.setPage} />}
        </>
      )}
    </>
  );

  return (
    <ListScaffold
      title="AMC contracts"
      description="Who is responsible for which assets, until when, under what SLA and at what cost."
      query={list}
      columns={columns}
      rowKey={(c) => c.id}
      onRowClick={(c) => navigate({ to: `/amc/${c.id}` })}
      searchPlaceholder="Search contract #, name, vendor…"
      filters={[
        { key: 'vendorId', placeholder: 'All vendors', options: (vendorsQ.data?.items ?? []).map((v) => ({ value: v.id, label: v.name })) },
        { key: 'status', placeholder: 'All statuses', options: opt(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWAL_PENDING']) },
        { key: 'coverageType', placeholder: 'Any coverage', options: opt(COVERAGE_TYPE) },
        { key: 'renewalDue', placeholder: 'Any renewal', options: RENEWAL },
        { key: 'expiry', placeholder: 'Any expiry', options: EXPIRY },
      ]}
      createPermission="amc:create"
      createLabel="New contract"
      onCreate={() => navigate({ to: '/amc/new' })}
      headerActions={<RegisterViewToggle view={view} onChange={setView} />}
      renderContent={view === 'card' ? cardBody : undefined}
    />
  );
}
