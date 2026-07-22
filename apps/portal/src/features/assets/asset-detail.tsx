import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Archive, Boxes, Camera, FileText, History, ListTree, Package, Pencil } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import {
  Button, Card, EmptyState, LoadingState, PageContainer, PageTransition,
  Sheet, SheetContent, toast, useConfirm,
} from '@living/ui';
import type { Asset } from '@living/types';

import { AssetForm, type AssetValues } from './asset-form';
import { AssetStatusBadge, WarrantyIndicator } from './asset-badges';
import { AssetDocuments } from './asset-documents';
import { AssetEventsList, AssetHistory } from './asset-events';
import { AssetOverview } from './asset-overview';
import { AssetPhotos } from './asset-photos';
import { assetLocation } from './location';
import {
  useAsset, useAssetCategories, useAssetDocuments, useAssetEvents, useAssetMutations,
  useAssetPhotos, useLocationOptions,
} from './queries';
import { Tabs, type TabDef } from '../shared/tabs';

const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

function toFormValues(a: Asset): Partial<AssetValues> {
  return {
    categoryId: a.categoryId, assetCode: a.assetCode, name: a.name, description: a.description ?? '',
    manufacturer: a.manufacturer ?? '', model: a.model ?? '', serialNumber: a.serialNumber ?? '',
    barcode: a.barcode ?? '', qrCode: a.qrCode ?? '', blockId: a.blockId ?? '', floorId: a.floorId ?? '',
    locationDescription: a.locationDescription ?? '', purchaseDate: dateInput(a.purchaseDate),
    installationDate: dateInput(a.installationDate), warrantyExpiry: dateInput(a.warrantyExpiry),
    expectedLifeMonths: a.expectedLifeMonths != null ? String(a.expectedLifeMonths) : '',
    status: a.status, criticality: a.criticality, condition: a.condition,
  };
}

export function AssetDetailPage() {
  const { assetId } = useParams({ strict: false }) as { assetId: string };
  const search = useSearch({ strict: false }) as { edit?: number };
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const q = useAsset(assetId);
  const asset = q.data;
  const { archive } = useAssetMutations(assetId);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (search.edit && hasPermission('asset:update')) setEditing(true); }, [search.edit, hasPermission]);

  // Counts for tab badges (lightweight; cached by TanStack Query).
  const photos = useAssetPhotos(assetId, !!asset);
  const documents = useAssetDocuments(assetId, !!asset);
  const events = useAssetEvents(assetId, !!asset);

  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;
  const canEdit = hasPermission('asset:update');

  async function onArchive() {
    if (!asset) return;
    if (!(await confirm({ title: `Archive ${asset.assetCode}?`, description: 'It will be hidden from the register. History is kept.', tone: 'danger', confirmLabel: 'Archive' }))) return;
    try {
      await archive.mutateAsync();
      toast.success('Asset archived');
      navigate({ to: '/assets' });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not archive');
    }
  }

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview', icon: ListTree },
    { key: 'photos', label: 'Photos', icon: Camera, count: photos.data?.length },
    { key: 'documents', label: 'Documents', icon: FileText, count: documents.data?.length },
    { key: 'history', label: 'History', icon: History },
    { key: 'events', label: 'Events', icon: Boxes, count: events.data?.length },
  ];

  if (q.isLoading) return <PageTransition><PageContainer><LoadingState className="h-[60vh]" /></PageContainer></PageTransition>;
  if (notFound || !asset) {
    return <PageTransition><PageContainer><EmptyState title="Asset not found" description="This asset no longer exists or was archived." /></PageContainer></PageTransition>;
  }

  return (
    <PageTransition>
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Summary panel */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <SummaryPanel asset={asset} canEdit={canEdit} canArchive={hasPermission('asset:delete')}
                onEdit={() => setEditing(true)} onArchive={onArchive} onBack={() => navigate({ to: '/assets' })} />
            </div>
          </div>

          {/* Tabbed content */}
          <div className="lg:col-span-2">
            <Card variant="elevated" padded={false} className="overflow-hidden">
              <div className="px-4 pt-2"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
              <div className="p-5">
                {tab === 'overview' && <AssetOverview asset={asset} />}
                {tab === 'photos' && <AssetPhotos assetId={asset.id} canEdit={canEdit} />}
                {tab === 'documents' && <AssetDocuments assetId={asset.id} canEdit={canEdit} />}
                {tab === 'history' && <AssetHistory assetId={asset.id} />}
                {tab === 'events' && <AssetEventsList assetId={asset.id} />}
              </div>
            </Card>
          </div>
        </div>

        <AssetEditDrawer asset={asset} open={editing} onOpenChange={setEditing} onSaved={() => q.refetch()} />
      </PageContainer>
    </PageTransition>
  );
}

function SummaryPanel({
  asset, canEdit, canArchive, onEdit, onArchive, onBack,
}: {
  asset: Asset; canEdit: boolean; canArchive: boolean;
  onEdit: () => void; onArchive: () => void; onBack: () => void;
}) {
  return (
    <Card variant="elevated" className="flex flex-col gap-5">
      <button onClick={onBack} className="self-start text-sm text-muted transition-colors hover:text-body">← Register</button>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tint text-brand"
          style={asset.category?.color ? { backgroundColor: `${asset.category.color}1a`, color: asset.category.color } : undefined}>
          <Package className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-h3 leading-tight tracking-tight text-strong">{asset.name}</h1>
          <p className="font-mono text-xs text-muted">{asset.assetCode}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AssetStatusBadge status={asset.status} size="md" />
        <WarrantyIndicator expiry={asset.warrantyExpiry} />
      </div>

      <dl className="flex flex-col gap-3 border-t border-border-subtle pt-4">
        <Row label="Category" value={asset.category?.name} />
        <Row label="Location" value={assetLocation(asset)} />
        <Row label="Installed" value={asset.installationDate ? formatDate(asset.installationDate) : null} />
        <Row label="Warranty" value={asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : null} />
        <Row label="Vendor" value={null} hint="Linked via AMC" />
      </dl>

      {(canEdit || canArchive) && (
        <div className="flex gap-2 border-t border-border-subtle pt-4">
          {canEdit && <Button variant="secondary" className="flex-1" onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</Button>}
          {canArchive && <Button variant="ghost" onClick={onArchive} aria-label="Archive asset"><Archive className="h-4 w-4" /></Button>}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, hint }: { label: string; value?: string | null; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-body">
        {value ?? <span className="text-subtle">{hint ?? '—'}</span>}
      </dd>
    </div>
  );
}

function AssetEditDrawer({ asset, open, onOpenChange, onSaved }: {
  asset: Asset; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const categoriesQ = useAssetCategories(asset.communityId);
  const { blocks, floors } = useLocationOptions(asset.communityId);
  const { update } = useAssetMutations(asset.id);

  async function onSubmit(body: Record<string, unknown>) {
    try {
      await update.mutateAsync(body);
      toast.success('Asset updated');
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not save');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right" title={`Edit ${asset.assetCode}`} className="w-[min(96vw,640px)]">
        <AssetForm
          mode="edit"
          initial={toFormValues(asset)}
          options={{
            categories: (categoriesQ.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
            blocks: blocks.map((b) => ({ value: b.id, label: b.name })),
            floors: floors.map((f) => ({ value: f.id, label: f.name ?? `Level ${f.level}` })),
          }}
          submitting={update.isPending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
