import { Link, useNavigate } from '@tanstack/react-router';
import { Package, Pencil } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import type { Asset } from '@living/types';
import { Button, EmptyState, Pagination, Skeleton } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { RegisterViewToggle, useCardView } from '../shared/register-view';
import { ASSET_STATUS } from './config';
import { AssetStatusBadge, WarrantyIndicator } from './asset-badges';
import { AssetCard } from './asset-card';
import { assetLocation } from './location';
import { useAssetCategories, useLocationOptions } from './queries';

const WARRANTY_WINDOWS = [
  { value: '30', label: 'Expiring ≤ 30 days' },
  { value: '60', label: 'Expiring ≤ 60 days' },
  { value: '90', label: 'Expiring ≤ 90 days' },
];

/** Translate the register's URL filters into asset-API params (warranty window → warrantyTo). */
function toParams(params: Record<string, unknown>): Record<string, unknown> {
  const { warrantyExpiring, ...rest } = params;
  if (typeof warrantyExpiring === 'string' && warrantyExpiring) {
    const days = Number(warrantyExpiring);
    rest.warrantyTo = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  return rest;
}

export function AssetsListPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useCardView('assets');
  const categoriesQ = useAssetCategories(communityId);
  const { blocks, floors } = useLocationOptions(communityId);
  const canEdit = hasPermission('asset:update');

  const list = useListQuery<Asset>({
    queryKey: ['assets', communityId ?? ''],
    basePath: '/assets',
    filterKeys: ['categoryId', 'status', 'blockId', 'floorId', 'warrantyExpiring'],
    defaultSort: 'createdAt',
    enabled: !!communityId,
    fetch: (params) => living.assets.list({ communityId: communityId!, ...toParams(params) }),
  });

  const columns: ListColumn<Asset>[] = [
    { key: 'assetCode', header: 'Code', sortKey: 'assetCode', cell: (a) => <span className="font-mono text-sm font-medium text-strong">{a.assetCode}</span> },
    {
      key: 'name', header: 'Name', sortKey: 'name',
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{a.name}</p>
          {a.manufacturer && <p className="truncate text-xs text-subtle">{a.manufacturer}{a.model ? ` · ${a.model}` : ''}</p>}
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortKey: 'categoryId', cell: (a) => a.category?.name ?? <span className="text-subtle">—</span> },
    { key: 'location', header: 'Location', cell: (a) => <span className="text-sm text-body">{assetLocation(a) ?? <span className="text-subtle">—</span>}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (a) => <AssetStatusBadge status={a.status} /> },
    { key: 'installation', header: 'Installed', cell: (a) => (a.installationDate ? formatDate(a.installationDate) : <span className="text-subtle">—</span>) },
    { key: 'warranty', header: 'Warranty', sortKey: 'warrantyExpiry', cell: (a) => <WarrantyIndicator expiry={a.warrantyExpiry} /> },
    { key: 'updated', header: 'Updated', cell: (a) => <span className="text-sm text-muted">{formatDate(a.updatedAt)}</span> },
    {
      key: 'actions', header: '', align: 'right',
      cell: (a) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link to={`/assets/${a.id}` as string} className="rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-body" aria-label={`Open ${a.assetCode}`}>
            <Package className="h-4 w-4" />
          </Link>
          {canEdit && (
            <Link to={`/assets/${a.id}` as string} search={{ edit: 1 }} className="rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-body" aria-label={`Edit ${a.assetCode}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  const categoryOptions = (categoriesQ.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));

  const cardBody = (
    <>
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-card" />)}
        </div>
      ) : list.isEmpty ? (
        <EmptyState icon={Package} title="No assets yet" description="Register your first asset to build the community's inventory."
          action={hasPermission('asset:create') ? <Button onClick={() => navigate({ to: '/assets/new' })}>New asset</Button> : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.items.map((a) => <AssetCard key={a.id} asset={a} />)}
          </div>
          {list.meta && list.meta.total > 0 && <Pagination meta={list.meta} onPageChange={list.setPage} />}
        </>
      )}
    </>
  );

  return (
    <ListScaffold
      title="Asset register"
      description="Every physical asset across the community — equipment, systems and infrastructure."
      query={list}
      columns={columns}
      rowKey={(a) => a.id}
      onRowClick={(a) => navigate({ to: `/assets/${a.id}` })}
      searchPlaceholder="Search name, code, serial, make…"
      filters={[
        { key: 'categoryId', placeholder: 'All categories', options: categoryOptions },
        { key: 'status', placeholder: 'All statuses', options: opt(ASSET_STATUS) },
        { key: 'blockId', placeholder: 'All blocks', options: blocks.map((b) => ({ value: b.id, label: b.name })) },
        { key: 'floorId', placeholder: 'All floors', options: floors.map((f) => ({ value: f.id, label: f.name ?? `Level ${f.level}` })) },
        { key: 'warrantyExpiring', placeholder: 'Any warranty', options: WARRANTY_WINDOWS },
      ]}
      createPermission="asset:create"
      createLabel="New asset"
      onCreate={() => navigate({ to: '/assets/new' })}
      headerActions={<RegisterViewToggle view={view} onChange={setView} />}
      renderContent={view === 'card' ? cardBody : undefined}
    />
  );
}
