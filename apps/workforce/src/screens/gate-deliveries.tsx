import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, PackageCheck, Plus, Radio, Send, Truck, X } from 'lucide-react';
import { LivingApiError, type GateEntry, type RealtimeEvent } from '@living/living-sdk';
import { useAuth, useRealtime } from '@living/hooks';
import { cn, timeAgo } from '@living/utils';
import {
  Badge, type BadgeProps, Button, EmptyState, Input, SearchInput, Sheet, SheetContent,
  Skeleton, toast,
} from '@living/ui';

import { living } from '../lib/living';
import { useWorker } from '../worker';
import { Section } from '../components';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = {
  CREATED: 'neutral', NOTIFIED: 'info', APPROVED: 'success',
  REJECTED: 'danger', COMPLETED: 'brand', CANCELLED: 'neutral',
};
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

/** The delivery brands a guard types over and over. Not a managed catalog —
 *  these are shortcuts, and the field stays free text. */
const COMMON_VENDORS = ['Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Blinkit', 'Zepto', 'BigBasket'];
const DELIVERY_TYPES = ['FOOD', 'COURIER', 'GROCERY', 'MEDICINE', 'OTHER'];

/**
 * Gate → Deliveries. The guard records an arrival, the resident is notified by
 * the Notification Engine, and their decision lands back on this screen over
 * the realtime stream — no refresh, no polling loop.
 */
export function GateDeliveriesScreen() {
  const { communityId } = useWorker();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = hasPermission('gate:entry:create');
  const canView = hasPermission('gate:entry:view');

  const query = useQuery({
    queryKey: ['gate-deliveries', communityId],
    queryFn: () =>
      living.gate.list(communityId!, { limit: 100, todayOnly: true, sortBy: 'createdAt', sortDir: 'desc' }),
    enabled: !!communityId && canView,
    // A slow fallback only: the realtime stream is what keeps this current.
    refetchInterval: 60_000,
  });

  // The whole point of the feature — a resident's decision appears instantly.
  const status = useRealtime({
    rooms: ['gate'],
    communityId,
    enabled: !!communityId && canView,
    onEvent: (event: RealtimeEvent) => {
      void qc.invalidateQueries({ queryKey: ['gate-deliveries'] });
      if (event.type === 'gate.entry.decided') {
        const entry = event.payload as GateEntry;
        const approved = entry.status === 'APPROVED';
        toast[approved ? 'success' : 'error'](
          `${entry.personName} — ${approved ? 'approved' : 'rejected'} by the resident`,
        );
      }
    },
  });

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = (query.data?.items ?? []).filter(
      (e) =>
        !needle ||
        e.personName.toLowerCase().includes(needle) ||
        (e.vendorName ?? '').toLowerCase().includes(needle) ||
        (e.mobileNumber ?? '').includes(needle) ||
        (e.unit?.unitNumber ?? '').toLowerCase().includes(needle),
    );
    return {
      waiting: all.filter((e) => e.status === 'CREATED' || e.status === 'NOTIFIED'),
      approved: all.filter((e) => e.status === 'APPROVED'),
      done: all.filter((e) => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(e.status)),
    };
  }, [query.data, q]);

  if (!canView) {
    // Name the requirement rather than saying a flat "no access". Gate duty is
    // granted by the SECURITY role, which is assigned from the staff member's
    // job title — so this is nearly always "your role is not set to Security"
    // or "the roles have not been reseeded since Gate Management shipped",
    // both of which an admin can fix in a minute if they know to look.
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={Truck}
          title="No gate access"
          description={
            'Gate duty is granted by the Security role. Ask your facility manager to set your ' +
            'staff role to Security, then sign out and back in.'
          }
        />
      </div>
    );
  }

  const empty =
    groups.waiting.length + groups.approved.length + groups.done.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <LiveDot status={status} />
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New delivery
          </Button>
        )}
      </div>

      <div className="px-4">
        <SearchInput value={q} onValueChange={setQ} placeholder="Search name, vendor, flat…" />
      </div>

      <div className="mt-4 flex flex-col gap-6 px-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
          </div>
        ) : empty ? (
          <EmptyState
            icon={Truck}
            title="No deliveries today"
            description={canCreate ? 'Record one when it arrives at the gate.' : undefined}
          />
        ) : (
          <>
            <Group title="Waiting on resident" entries={groups.waiting} />
            <Group title="Approved — hand over" entries={groups.approved} />
            <Group title="Closed today" entries={groups.done} muted />
          </>
        )}
      </div>

      {communityId && canCreate && (
        <NewDeliverySheet
          open={creating}
          onOpenChange={setCreating}
          communityId={communityId}
        />
      )}
    </div>
  );
}

/** Honest connection indicator — a guard must know if updates stopped flowing. */
function LiveDot({ status }: { status: 'connecting' | 'open' | 'closed' }) {
  const label = status === 'open' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-2xs font-medium',
        status === 'open' ? 'text-success-fg' : 'text-subtle',
      )}
    >
      <Radio className={cn('h-3.5 w-3.5', status === 'open' && 'animate-pulse')} />
      {label}
    </span>
  );
}

function Group({ title, entries, muted }: { title: string; entries: GateEntry[]; muted?: boolean }) {
  if (entries.length === 0) return null;
  return (
    <Section
      title={title}
      action={<span className="rounded-full bg-sunken px-2 py-0.5 text-2xs text-muted">{entries.length}</span>}
    >
      <div className="flex flex-col gap-2">
        {entries.map((e) => <DeliveryCard key={e.id} entry={e} muted={muted} />)}
      </div>
    </Section>
  );
}

function DeliveryCard({ entry, muted }: { entry: GateEntry; muted?: boolean }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['gate-deliveries'] });

  const complete = useMutation({
    mutationFn: () => living.gate.complete(entry.id),
    onSuccess: () => { invalidate(); toast.success('Handed over'); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Failed'),
  });
  const cancel = useMutation({
    mutationFn: () => living.gate.cancel(entry.id),
    onSuccess: () => { invalidate(); toast.success('Cancelled'); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Failed'),
  });

  const waiting = entry.status === 'CREATED' || entry.status === 'NOTIFIED';

  return (
    <div className={cn('rounded-card bg-card p-4 shadow-sm', muted && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-strong">
            {entry.vendorName ? `${entry.vendorName} · ` : ''}{entry.personName}
          </p>
          <p className="truncate text-xs text-muted">
            {entry.unit?.unitNumber ?? 'Unit'}
            {entry.resident ? ` · ${entry.resident.firstName} ${entry.resident.lastName}` : ''}
            {' · '}{timeAgo(entry.createdAt)}
          </p>
        </div>
        <Badge tone={TONE[entry.status] ?? 'neutral'} size="sm" dot>{humanize(entry.status)}</Badge>
      </div>

      {/* The one thing a guard must not miss: nobody was actually reached. */}
      {entry.notificationFailed && waiting && (
        <p className="mt-2 rounded-control bg-warning-bg px-2.5 py-1.5 text-2xs text-warning-fg">
          Resident could not be notified — call them on {entry.resident?.mobile ?? 'their number'}.
        </p>
      )}
      {entry.decisionNote && (
        <p className="mt-2 text-xs italic text-muted">“{entry.decisionNote}”</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-2xs text-subtle">{entry.entryNumber}</span>
        <div className="flex gap-2">
          {entry.status === 'APPROVED' && hasPermission('gate:entry:complete') && (
            <Button size="sm" loading={complete.isPending} onClick={() => complete.mutate()}>
              <PackageCheck className="h-4 w-4" /> Handed over
            </Button>
          )}
          {waiting && hasPermission('gate:entry:update') && (
            <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The entry form. Apartment search drives resident auto-fill, so the guard
 * never has to know who lives where — they type the flat number they were told.
 */
function NewDeliverySheet({
  open,
  onOpenChange,
  communityId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  communityId: string;
}) {
  const qc = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);

  const [unitQuery, setUnitQuery] = useState('');
  const [unit, setUnit] = useState<{ id: string; unitNumber: string } | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [deliveryType, setDeliveryType] = useState('FOOD');
  const [personName, setPersonName] = useState('');
  const [mobile, setMobile] = useState('');
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const units = useQuery({
    queryKey: ['gate-units', communityId, unitQuery],
    queryFn: () =>
      living.community.listUnits(communityId, { limit: 12, search: unitQuery, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: open && unitQuery.trim().length >= 1 && !unit,
  });

  // Who lives there — shown so the guard can confirm before submitting.
  // Uses the gate's own occupants endpoint (name + mobile), NOT the resident
  // register: the gate desk deliberately holds no `resident:read`.
  const occupants = useQuery({
    queryKey: ['gate-unit-occupants', unit?.id],
    queryFn: () => living.gate.unitOccupants(communityId, unit!.id),
    enabled: open && !!unit,
  });

  const reset = () => {
    setUnitQuery(''); setUnit(null); setVendorName(''); setDeliveryType('FOOD');
    setPersonName(''); setMobile(''); setRemarks(''); setPhoto(null);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!unit) throw new Error('Choose the apartment');
      if (!personName.trim()) throw new Error('Enter the delivery person’s name');

      let photoKey: string | undefined;
      if (photo) {
        const contentType = photo.type || 'application/octet-stream';
        const signed = await living.gate.photoUploadUrl(communityId, {
          fileName: photo.name || 'gate-photo.jpg',
          contentType,
        });
        const put = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: photo,
        });
        // A failed photo must not block the delivery — the resident is waiting.
        if (put.ok) photoKey = signed.key;
        else toast.error('Photo upload failed — saving without it');
      }

      return living.gate.create(communityId, {
        entryType: 'DELIVERY',
        unitId: unit.id,
        vendorName: vendorName.trim() || undefined,
        deliveryType,
        personName: personName.trim(),
        mobileNumber: mobile.trim() || undefined,
        remarks: remarks.trim() || undefined,
        photoKey,
      });
    },
    onSuccess: (entry) => {
      void qc.invalidateQueries({ queryKey: ['gate-deliveries'] });
      // The specified outcome message — the guard must know whether the
      // resident was actually reached, not merely that the row saved.
      if (entry.notificationFailed) {
        toast.error('Saved, but the resident could not be notified — call them.');
      } else {
        toast.success('Notification sent successfully');
      }
      reset();
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(err instanceof LivingApiError ? err.message : (err as Error).message),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent open={open} side="bottom" title="New delivery" className="max-h-[92dvh] overflow-y-auto">
        <div className="flex flex-col gap-3">
          {/* Apartment first — everything else depends on it. */}
          {unit ? (
            <div className="flex items-center justify-between rounded-control bg-sunken px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-strong" data-numeric>{unit.unitNumber}</p>
                <p className="truncate text-xs text-muted">
                  {occupants.isLoading
                    ? 'Looking up resident…'
                    : (occupants.data?.residents ?? []).length === 0
                      ? 'No resident linked — security will hold it'
                      : (occupants.data?.residents ?? [])
                          .map((r) => `${r.firstName} ${r.lastName}`)
                          .join(', ')}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setUnit(null); setUnitQuery(''); }}>
                Change
              </Button>
            </div>
          ) : (
            <div>
              <Input
                label="Apartment"
                value={unitQuery}
                onChange={(e) => setUnitQuery(e.target.value)}
                placeholder="A-101"
                autoFocus
              />
              {unitQuery.trim() && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {units.isLoading ? (
                    <Skeleton className="h-8 w-24 rounded-pill" />
                  ) : (units.data?.items ?? []).length === 0 ? (
                    <p className="text-xs text-subtle">No matching apartment.</p>
                  ) : (
                    (units.data?.items ?? []).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUnit({ id: u.id, unitNumber: u.unitNumber })}
                        className="rounded-pill bg-sunken px-3 py-1.5 text-sm text-body"
                      >
                        {u.unitNumber}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Input
              label="Vendor"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Swiggy"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_VENDORS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVendorName(v)}
                  className={cn(
                    'rounded-pill px-2.5 py-1 text-xs',
                    vendorName === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Type</span>
            <div className="flex flex-wrap gap-1.5">
              {DELIVERY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDeliveryType(t)}
                  className={cn(
                    'rounded-pill px-3 py-1.5 text-sm',
                    deliveryType === t ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted',
                  )}
                >
                  {humanize(t)}
                </button>
              ))}
            </div>
          </label>

          <Input
            label="Delivery person"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="Ramesh"
          />
          <Input
            label="Phone number"
            type="tel"
            inputMode="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
          <Input
            label="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="2 bags"
          />

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
            {photo ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {photo ? 'Photo attached' : 'Take photo (optional)'}
          </Button>

          <Button
            size="lg"
            block
            className="mt-1"
            loading={submit.isPending}
            disabled={!unit || !personName.trim()}
            onClick={() => submit.mutate()}
          >
            <Send className="h-4 w-4" /> Save &amp; notify resident
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
