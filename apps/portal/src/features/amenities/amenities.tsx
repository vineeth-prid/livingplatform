import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CalendarCheck, Users } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import type { Amenity } from '@living/types';
import { Badge, Button, Input, Sheet, SheetContent, toast } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, StatusBadge, type ListColumn } from '../master-data';
import { CheckboxField, FormFooter, FormGrid, FormSection, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';

const STATUS = [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }];
const BOOKABLE = [{ value: 'true', label: 'Bookable' }, { value: 'false', label: 'Not bookable' }];

function toParams(p: Record<string, unknown>): Record<string, unknown> {
  const { isBookable, ...rest } = p;
  if (isBookable === 'true') rest.isBookable = true; else if (isBookable === 'false') rest.isBookable = false;
  return rest;
}

export function AmenitiesPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useListQuery<Amenity>({
    queryKey: ['amenities', communityId ?? ''],
    basePath: '/amenities',
    filterKeys: ['category', 'status', 'isBookable'],
    defaultSort: 'sortOrder',
    enabled: !!communityId,
    fetch: (params) => living.amenities.list(communityId!, toParams(params)),
  });

  const columns: ListColumn<Amenity>[] = [
    { key: 'name', header: 'Amenity', sortKey: 'name', cell: (a) => <div className="min-w-0"><p className="truncate font-medium text-strong">{a.name}</p>{a.category && <p className="text-xs text-subtle">{a.category}</p>}</div> },
    { key: 'location', header: 'Location', cell: (a) => <span className="text-sm text-body">{a.location ?? '—'}</span> },
    { key: 'capacity', header: 'Capacity', cell: (a) => <span className="inline-flex items-center gap-1 text-sm text-muted">{a.capacity != null ? <><Users className="h-3.5 w-3.5" /> {a.capacity}</> : '—'}</span> },
    { key: 'bookable', header: 'Booking', cell: (a) => a.isBookable ? <Badge tone="brand" size="sm" dot>Bookable</Badge> : <Badge tone="neutral" size="sm">Not bookable</Badge> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (a) => <StatusBadge status={a.status} /> },
    { key: 'actions', header: '', align: 'right', cell: (a) => hasPermission('amenity:update') ? <div onClick={(e) => e.stopPropagation()}><Button size="sm" variant="secondary" onClick={() => setEditing(a)}>Edit</Button></div> : null },
  ];

  return (
    <>
      <ListScaffold
        title="Amenities"
        description="Community facilities residents can browse and book."
        query={list}
        columns={columns}
        rowKey={(a) => a.id}
        onRowClick={(a) => hasPermission('amenity:update') ? setEditing(a) : navigate({ to: '/amenities' })}
        searchPlaceholder="Search amenities…"
        filters={[{ key: 'status', placeholder: 'All statuses', options: STATUS }, { key: 'isBookable', placeholder: 'Any', options: BOOKABLE }]}
        createPermission="amenity:create"
        createLabel="New amenity"
        onCreate={() => setCreating(true)}
      />
      {communityId && <AmenityDrawer key={editing?.id ?? 'new'} communityId={communityId} amenity={editing} open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => list.refetch()} />}
    </>
  );
}

const hoursOf = (a?: Amenity | null): { open: string; close: string } => {
  const h = (a?.operatingHours ?? {}) as { openingTime?: string; closingTime?: string };
  return { open: h.openingTime ?? '', close: h.closingTime ?? '' };
};

function AmenityDrawer({ communityId, amenity, open, onClose, onSaved }: {
  communityId: string; amenity: Amenity | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!amenity;
  const [name, setName] = useState(amenity?.name ?? '');
  const [category, setCategory] = useState(amenity?.category ?? '');
  const [location, setLocation] = useState(amenity?.location ?? '');
  const [capacity, setCapacity] = useState(amenity?.capacity != null ? String(amenity.capacity) : '');
  const [description, setDescription] = useState(amenity?.description ?? '');
  const [isBookable, setIsBookable] = useState(amenity?.isBookable ?? false);
  const [status, setStatus] = useState(amenity?.status ?? 'ACTIVE');
  const init = hoursOf(amenity);
  const [openTime, setOpenTime] = useState(init.open);
  const [closeTime, setCloseTime] = useState(init.close);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => editing ? living.amenities.update(amenity!.id, body) : living.amenities.create(communityId, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['amenities'] }); toast.success('Saved'); onClose(); onSaved(); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Could not save'),
  });

  const submit = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    save.mutate({
      name: name.trim(), category: category.trim() || undefined, location: location.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined, description: description.trim() || undefined,
      isBookable, status,
      operatingHours: openTime && closeTime ? { openingTime: openTime, closingTime: closeTime } : undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent open={open} side="right" title={editing ? `Edit ${amenity!.name}` : 'New amenity'} className="w-[min(94vw,560px)]">
        <div className="flex flex-col gap-5">
          <FormSection title="Details">
            <FormGrid>
              <FullWidth><Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Swimming pool" /></FullWidth>
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Recreation" />
              <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Clubhouse, Level 1" />
              <Input label="Capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              <SelectField label="Status" value={status} onChange={(v) => setStatus(v as 'ACTIVE')} options={STATUS} />
              <FullWidth><TextAreaField label="Description" value={description} onChange={setDescription} /></FullWidth>
            </FormGrid>
          </FormSection>

          <FormSection title="Booking" description="Bookable amenities appear in the resident booking flow. Booking window and slot length are configured server-side.">
            <FormGrid>
              <FullWidth><CheckboxField label="Bookable" checked={isBookable} onChange={setIsBookable} hint="Allow residents to reserve slots." /></FullWidth>
              <Input label="Opens at" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              <Input label="Closes at" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </FormGrid>
          </FormSection>

          <div className="flex items-center gap-2 text-xs text-subtle"><CalendarCheck className="h-4 w-4" /> Booking window {amenity?.bookingWindowDays ?? 30} days · slots {amenity?.slotDurationMinutes ?? 60} min</div>

          <FormFooter submitLabel={editing ? 'Save changes' : 'Create amenity'} submitting={save.isPending} onSubmit={submit} onCancel={onClose} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
