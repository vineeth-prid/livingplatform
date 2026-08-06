import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wrench } from 'lucide-react';
import type { Service, ServiceVariant } from '@living/types';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, PageContainer, PageHeader,
  SearchInput, Sheet, SheetContent, toast, useConfirm, type Column,
} from '@living/ui';

import { living } from '../../lib/living';
import { FormGrid, FormSection, FullWidth, TextAreaField } from '../shared/form-kit';

/**
 * The service catalog a community offers.
 *
 * Availability is a STATUS, not a deletion: an inactive service disappears from
 * the resident app and can no longer be requested, while every historical
 * request keeps pointing at it and in-flight work carries on.
 *
 * Two kinds of row live here. A COMMUNITY service is the tenant's own and can be
 * created, edited and deleted freely. A PLATFORM service is one row shared by
 * every tenant, so it can only be withdrawn — the Availability switch records
 * that against this tenant alone, leaving other communities untouched. An admin
 * who wants their own wording or price creates a community service instead.
 */
export function ServicesPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = hasPermission('service:catalog:manage');

  const services = useQuery({
    queryKey: ['services', 'catalog', search],
    queryFn: () => living.serviceRequest.listServices({ search: search || undefined }),
  });

  const confirmDelete = useConfirm();

  const remove = useMutation({
    mutationFn: (id: string) => living.serviceRequest.deleteService(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /**
   * Deleting is for a service created in error. Withdrawing one that residents
   * have actually used should be a deactivation, so the confirmation says which
   * is which and reports what still references it.
   */
  const onDelete = async (service: Service) => {
    const usage = await living.serviceRequest
      .serviceUsage(service.id)
      .catch(() => ({ openRequests: 0, packages: 0 }));

    const blockers = [
      usage.openRequests > 0 && `${usage.openRequests} open request(s)`,
      usage.packages > 0 && `${usage.packages} package(s)`,
    ].filter(Boolean) as string[];

    const ok = await confirmDelete({
      title: `Delete ${service.name}?`,
      description: blockers.length
        ? `This service is still referenced by ${blockers.join(' and ')}. Deactivating it instead ` +
          'withdraws it from the resident app while keeping that history intact.'
        : 'Residents will no longer see this service. History is preserved.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) remove.mutate(service.id);
  };

  const setStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      living.serviceRequest.setServiceStatus(id, isActive),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(variables.isActive ? 'Service activated' : 'Service deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = services.data ?? [];

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Service',
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{s.name}</p>
          <p className="truncate font-mono text-xs text-subtle">{s.key}</p>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      cell: (s) => (
        <span className="text-sm text-body">
          {s.estimatedDurationMinutes != null ? `~${s.estimatedDurationMinutes} min` : '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'List price',
      cell: (s) => (
        <span className="text-sm text-body">
          {s.basePrice != null ? `₹${Number(s.basePrice).toLocaleString('en-IN')}` : '—'}
        </span>
      ),
    },
    {
      key: 'origin',
      header: 'Origin',
      cell: (s) =>
        s.isSystem ? (
          <Badge tone="neutral" size="sm">
            platform
          </Badge>
        ) : (
          <Badge tone="brand" size="sm">
            community
          </Badge>
        ),
    },
    {
      key: 'status',
      header: 'Availability',
      cell: (s) => (
        <StatusSwitch
          service={s}
          disabled={!canManage || setStatus.isPending}
          onChange={(isActive) => setStatus.mutate({ id: s.id, isActive })}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      // A platform service is one row shared by every community, so it can be
      // Platform rows are editable too: editing one hands this community its
      // own copy and withdraws the shared default here alone, so a rename or
      // reprice never reaches a community that did not ask for it. Deletion
      // stays off the table — the Availability switch is how a service is
      // withdrawn, and history keeps resolving it.
      cell: (s) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
              Edit
            </Button>
            {!s.isSystem && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${s.name}`}
                disabled={remove.isPending}
                onClick={() => void onDelete(s)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Services"
        description="What residents can book. Deactivate a service to withdraw it without losing its history."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New service
            </Button>
          ) : null
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search services…" />
      </div>

      {services.isLoading ? (
        <LoadingState label="Loading services…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No services yet"
          description="Publish a service so residents can book it."
          action={canManage ? <Button onClick={() => setCreating(true)}>Add a service</Button> : undefined}
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} />
        </Card>
      )}

      <ServiceDrawer
        key={editing?.id ?? 'new'}
        service={editing}
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </PageContainer>
  );
}

/**
 * Deactivating asks for confirmation and says what it will affect — an admin
 * should know a service is inside packages or has open requests before pulling
 * it from the app.
 */
function StatusSwitch({
  service,
  disabled,
  onChange,
}: {
  service: Service;
  disabled: boolean;
  onChange: (isActive: boolean) => void;
}) {
  const confirm = useConfirm();

  async function toggle() {
    if (service.isActive) {
      const usage = await living.serviceRequest.serviceUsage(service.id).catch(() => null);
      const detail = usage
        ? [
            usage.openRequests > 0 ? `${usage.openRequests} open request(s) continue unaffected` : null,
            usage.packages > 0 ? `it is included in ${usage.packages} package(s)` : null,
          ]
            .filter(Boolean)
            .join(', ')
        : '';
      const ok = await confirm({
        title: `Deactivate ${service.name}?`,
        description: `Residents will no longer see or be able to book it${detail ? ` — ${detail}` : ''}. Nothing is deleted.`,
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onChange(!service.isActive);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={service.isActive}
      aria-label={`${service.name} availability`}
      disabled={disabled}
      onClick={toggle}
      className="flex items-center gap-2 focus-visible:outline-none focus-visible:shadow-ring rounded-pill"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          service.isActive ? 'bg-success-solid' : 'bg-sunken'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-raised shadow-sm transition-transform ${
            service.isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className={`text-sm ${service.isActive ? 'text-success-fg' : 'text-subtle'}`}>
        {service.isActive ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}

function ServiceDrawer({
  service,
  open,
  onClose,
}: {
  service: Service | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!service;
  const [key, setKey] = useState(service?.key ?? '');
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(
    service?.estimatedDurationMinutes != null ? String(service.estimatedDurationMinutes) : '',
  );
  const [basePrice, setBasePrice] = useState(
    service?.basePrice != null ? String(service.basePrice) : '',
  );

  const save = useMutation({
    mutationFn: () => {
      const input = {
        key: key.trim().toUpperCase().replace(/\s+/g, '_'),
        name,
        description: description || undefined,
        estimatedDurationMinutes: duration ? Number(duration) : undefined,
        basePrice: basePrice ? Number(basePrice) : undefined,
      };
      return editing
        ? living.serviceRequest.updateService(service!.id, input)
        : living.serviceRequest.createService(input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(editing ? 'Service updated' : 'Service created');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent open={open} title={editing ? `Edit ${service!.name}` : 'New service'}>
        <div className="space-y-6">
          <FormSection title="Service" description="What residents see when they browse and book.">
            <FormGrid>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="DEEP_CLEANING"
                hint="Vendors are matched to this key or the name"
                required
                disabled={editing}
              />
              <Input
                label="Typical duration (minutes)"
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <Input
                label="List price (₹)"
                type="number"
                inputMode="decimal"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                hint="Used to price packages and show savings"
              />
              <FullWidth>
                <TextAreaField label="Description" value={description} onChange={setDescription} />
              </FullWidth>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Priced options"
            description="Car type, flat size — anything that changes the price. Leave empty to charge the list price for everyone."
          >
            <VariantEditor
              // Options are saved against a service that must already exist,
              // so they are only editable once it has been created.
              serviceId={service?.id ?? null}
              initial={service?.variants ?? []}
            />
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || !key.trim()}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {editing ? 'Save service' : 'Create service'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The priced options for a service, edited as a set.
 *
 * Saved separately from the service itself, and only once the service exists —
 * an option needs something to belong to. Removing one here deactivates it
 * rather than deleting it, so a request booked as "SUV · ₹500" still resolves
 * that name and price months later.
 */
function VariantEditor({
  serviceId,
  initial,
}: {
  serviceId: string | null;
  initial: ServiceVariant[];
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<VariantRow[]>(() =>
    initial.map((v) => ({
      id: v.id,
      name: v.name,
      price: String(v.price ?? ''),
      durationMinutes: v.durationMinutes != null ? String(v.durationMinutes) : '',
    })),
  );

  const save = useMutation({
    mutationFn: () =>
      living.serviceRequest.setServiceVariants(
        serviceId!,
        rows.map((r) => ({
          id: r.id,
          name: r.name.trim(),
          price: Number(r.price),
          durationMinutes: r.durationMinutes ? Number(r.durationMinutes) : null,
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Options saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!serviceId) {
    return (
      <p className="rounded-control bg-sunken px-4 py-3 text-sm text-muted">
        Create the service first, then reopen it to add priced options.
      </p>
    );
  }

  const valid = rows.every((r) => r.name.trim() && Number.isFinite(Number(r.price)));

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="rounded-control bg-sunken px-4 py-3 text-sm text-muted">
          No options — every resident pays the list price above.
        </p>
      ) : (
        rows.map((row, index) => (
          <div key={row.id ?? `new-${index}`} className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={index === 0 ? 'Option' : undefined}
                value={row.name}
                placeholder="SUV"
                onChange={(e) =>
                  setRows((rs) => rs.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
                }
              />
            </div>
            <div className="w-28">
              <Input
                label={index === 0 ? 'Price (₹)' : undefined}
                type="number"
                inputMode="decimal"
                value={row.price}
                onChange={(e) =>
                  setRows((rs) => rs.map((r, i) => (i === index ? { ...r, price: e.target.value } : r)))
                }
              />
            </div>
            <div className="w-28">
              <Input
                label={index === 0 ? 'Minutes' : undefined}
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={row.durationMinutes}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, i) => (i === index ? { ...r, durationMinutes: e.target.value } : r)),
                  )
                }
              />
            </div>
            <Button
              variant="ghost"
              aria-label={`Remove ${row.name || 'option'}`}
              onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setRows((rs) => [...rs, { name: '', price: '', durationMinutes: '' }])
          }
        >
          <Plus className="h-4 w-4" /> Add option
        </Button>
        <Button size="sm" loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
          Save options
        </Button>
      </div>
    </div>
  );
}

interface VariantRow {
  id?: string;
  name: string;
  price: string;
  durationMinutes: string;
}
