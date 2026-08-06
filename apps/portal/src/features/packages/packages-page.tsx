import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Package, Plus, Trash2 } from 'lucide-react';
import type { PackageInput, ServicePackage } from '@living/living-sdk';
import type { Service } from '@living/types';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, PageContainer, PageHeader,
  Sheet, SheetContent, toast, useConfirm, type Column,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { inr } from '../billing/queries';
import { FormGrid, FormSection, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';

/**
 * Service Packages — bundles of services that already exist in the catalog.
 *
 * There is no package-specific service editor here on purpose: a package can
 * only reference catalog rows, so what a community sells and what it can
 * actually deliver never drift apart.
 */
export function PackagesPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<ServicePackage | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = hasPermission('package:manage');

  const packages = useQuery({
    queryKey: ['packages', communityId],
    queryFn: () => living.packages.list(communityId!, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }),
    enabled: !!communityId,
  });

  const mutate = <T,>(fn: (id: string) => Promise<T>, message: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['packages', communityId] });
      toast.success(message);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      living.packages.setStatus(communityId!, id, status),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['packages', communityId] });
      toast.success(v.status === 'ACTIVE' ? 'Package published' : 'Package withdrawn');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /**
   * Withdrawing is not a silent flip: it stops new purchases, and an admin's
   * first question is what happens to residents who already bought it. Answer
   * that with the real number before they commit. Publishing needs no ceremony.
   */
  const onToggleStatus = async (p: ServicePackage) => {
    if (p.status !== 'ACTIVE') {
      setStatus.mutate({ id: p.id, status: 'ACTIVE' });
      return;
    }
    const live = await living.packages
      .livePurchases(communityId!, p.id)
      .catch(() => ({ active: 0 }));
    const ok = await confirm({
      title: `Withdraw ${p.name}?`,
      description:
        `It stops being purchasable and leaves the resident app immediately. ${
          live.active > 0
            ? `${live.active} resident${live.active === 1 ? '' : 's'} already bought it and keep${live.active === 1 ? 's' : ''} it until their own expiry — nothing is taken back.`
            : 'Nobody is currently using it.'
        } You can publish it again at any time.`,
      confirmLabel: 'Withdraw',
    });
    if (ok) setStatus.mutate({ id: p.id, status: 'INACTIVE' });
  };

  const duplicate = useMutation(
    mutate((id: string) => living.packages.duplicate(communityId!, id), 'Copied as an inactive draft'),
  );
  const remove = useMutation(
    mutate((id: string) => living.packages.remove(communityId!, id), 'Package deleted'),
  );

  const rows = packages.data?.items ?? [];

  const columns: Column<ServicePackage>[] = [
    {
      key: 'name',
      header: 'Package',
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{p.name}</p>
          <p className="truncate text-xs text-subtle">
            {p.items.map((i) => `${i.quantity}× ${i.serviceName}`).join(' · ') || 'No services'}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      cell: (p) => (
        <div>
          <p className="text-sm font-medium text-strong">{inr(p.price)}</p>
          {p.savings !== null && p.savings > 0 && (
            <p className="text-xs text-success-fg">
              saves {inr(p.savings)}
              {p.savingsPercent ? ` (${p.savingsPercent}%)` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Valid for',
      cell: (p) => <span className="text-sm text-body">{p.durationDays} days</span>,
    },
    {
      key: 'types',
      header: 'Property types',
      cell: (p) => (
        <span className="text-sm text-body">
          {p.propertyTypes.length === 0 ? 'All types' : p.propertyTypes.join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <button
          type="button"
          role="switch"
          aria-checked={p.status === 'ACTIVE'}
          aria-label={`${p.name} availability`}
          disabled={!canManage || setStatus.isPending}
          onClick={() => void onToggleStatus(p)}
          className="focus-visible:outline-none focus-visible:shadow-ring rounded-pill"
        >
          <Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" dot>
            {p.status.toLowerCase()}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) =>
        canManage ? (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Duplicate ${p.name}`}
              loading={duplicate.isPending}
              onClick={() => duplicate.mutate(p.id)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${p.name}`}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${p.name}?`,
                  description:
                    'Only possible while it has never been purchased. Otherwise withdraw it instead.',
                  confirmLabel: 'Delete',
                  tone: 'danger',
                });
                if (ok) remove.mutate(p.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Service packages"
        description="Bundles of existing services sold at a package price. Residents see these before individual services."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New package
            </Button>
          ) : null
        }
      />

      {packages.isLoading ? (
        <LoadingState label="Loading packages…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No packages yet"
          description="Bundle a few services at a package price to increase adoption."
          action={canManage ? <Button onClick={() => setCreating(true)}>Create a package</Button> : undefined}
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(p) => p.id} />
        </Card>
      )}

      {communityId && (
        <PackageDrawer
          key={editing?.id ?? 'new'}
          communityId={communityId}
          pkg={editing}
          open={creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </PageContainer>
  );
}

interface DraftItem {
  serviceId: string;
  quantity: number;
}

function PackageDrawer({
  communityId,
  pkg,
  open,
  onClose,
}: {
  communityId: string;
  pkg: ServicePackage | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!pkg;

  const services = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => living.serviceRequest.listServices({ activeOnly: true }),
    enabled: open,
  });
  const propertyTypes = useQuery({
    queryKey: ['billing', 'property-types', communityId],
    queryFn: () => living.billing.propertyTypes(communityId),
    enabled: open,
  });

  const [name, setName] = useState(pkg?.name ?? '');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [price, setPrice] = useState(pkg ? String(pkg.price) : '');
  const [durationDays, setDurationDays] = useState(String(pkg?.durationDays ?? 90));
  const [types, setTypes] = useState<string[]>(pkg?.propertyTypes ?? []);
  const [items, setItems] = useState<DraftItem[]>(
    pkg?.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })) ?? [],
  );

  const catalog = services.data ?? [];
  const byId = useMemo(() => new Map(catalog.map((s) => [s.id, s])), [catalog]);

  /** Live saving preview, computed the same way the API freezes it on save. */
  const listPrice = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const base = byId.get(item.serviceId)?.basePrice;
      if (base == null) return null;
      total += Number(base) * item.quantity;
    }
    return items.length > 0 ? total : null;
  }, [items, byId]);
  const savings = listPrice !== null && price ? Math.max(0, listPrice - Number(price)) : null;

  const save = useMutation({
    mutationFn: () => {
      const input: PackageInput = {
        name,
        description: description || undefined,
        price: Number(price),
        durationDays: Number(durationDays),
        propertyTypes: types,
        items: items.map((i, index) => ({ ...i, sortOrder: index })),
      };
      return editing
        ? living.packages.update(communityId, pkg!.id, input)
        : living.packages.create(communityId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['packages', communityId] });
      toast.success(editing ? 'Package updated' : 'Package created');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const available = catalog.filter((s) => !items.some((i) => i.serviceId === s.id));
  const valid = name.trim().length > 0 && Number(price) >= 0 && items.length > 0;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent open={open} title={editing ? `Edit ${pkg!.name}` : 'New package'}>
        <div className="space-y-6">
          <FormSection title="Package" description="What the resident is buying.">
            <FormGrid>
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="3 Month Home Care"
                required
              />
              <Input
                label="Package price (₹)"
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <Input
                label="Valid for (days)"
                type="number"
                inputMode="numeric"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                hint="How long the entitlements stay redeemable after purchase"
              />
              <FullWidth>
                <TextAreaField label="Description" value={description} onChange={setDescription} />
              </FullWidth>
            </FormGrid>

            {listPrice !== null && (
              <div className="mt-4 rounded-control bg-sunken px-3 py-2 text-sm">
                <span className="text-muted">Services at list price </span>
                <span className="font-medium text-strong">{inr(listPrice)}</span>
                {savings !== null && savings > 0 && (
                  <span className="text-success-fg">
                    {' '}
                    · resident saves {inr(savings)} ({Math.round((savings / listPrice) * 100)}%)
                  </span>
                )}
              </div>
            )}
            {listPrice === null && items.length > 0 && (
              <p className="mt-4 text-xs text-subtle">
                Set a list price on each service to advertise a saving.
              </p>
            )}
          </FormSection>

          <FormSection
            title="Included services"
            description="Pick from the catalog and set how many times each may be redeemed."
          >
            {items.length === 0 ? (
              <p className="rounded-control bg-sunken px-4 py-6 text-center text-sm text-muted">
                No services yet — add at least one.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item, index) => (
                  <div key={item.serviceId} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-body">
                      {byId.get(item.serviceId)?.name ?? item.serviceId}
                    </span>
                    <Input
                      aria-label={`Quantity for ${byId.get(item.serviceId)?.name ?? 'service'}`}
                      type="number"
                      inputMode="numeric"
                      className="w-20"
                      value={String(item.quantity)}
                      onChange={(e) =>
                        setItems((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, quantity: Math.max(1, Number(e.target.value) || 1) } : r,
                          ),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remove service"
                      onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {available.length > 0 && (
              <div className="mt-4">
                <SelectField
                  label="Add a service"
                  value=""
                  onChange={(serviceId) =>
                    serviceId && setItems((rows) => [...rows, { serviceId, quantity: 1 }])
                  }
                  options={available.map((s: Service) => ({
                    value: s.id,
                    label: s.basePrice != null ? `${s.name} — ${inr(Number(s.basePrice))}` : s.name,
                  }))}
                  placeholder="Choose a service…"
                />
              </div>
            )}
          </FormSection>

          <FormSection
            title="Availability"
            description="Leave every type unticked to offer this package to all property types."
          >
            <div className="flex flex-wrap gap-2">
              {(propertyTypes.data ?? []).map((t) => {
                const on = types.includes(t.type);
                return (
                  <button
                    key={t.type}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTypes((rows) =>
                        on ? rows.filter((r) => r !== t.type) : [...rows, t.type],
                      )
                    }
                    className={`rounded-pill px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:shadow-ring ${
                      on ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted'
                    }`}
                  >
                    {t.type}
                  </button>
                );
              })}
            </div>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
              {editing ? 'Save package' : 'Create package'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
