import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserRound } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import type { GateEntry } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Badge, type BadgeProps, Button, EmptyState, Input, Sheet, SheetContent, Skeleton, toast, useConfirm } from '@living/ui';

import { useResidentCommunity } from '../community';
import { living } from '../lib/living';
import { ScreenHeader } from '../shell';

/**
 * A resident's visitors — now ordinary VISITOR gate entries.
 *
 * This screen used to write to a separate `visitors` table that the security
 * console never read, so an invitation the resident raised (and an admin
 * approved) stayed invisible at the gate. It is the same engine as deliveries
 * now: the guard sees the invitation the moment it exists, and either the guard
 * or an admin can decide it.
 */
type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = {
  CREATED: 'info', NOTIFIED: 'info', APPROVED: 'brand',
  COMPLETED: 'success', REJECTED: 'danger', CANCELLED: 'neutral',
};
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
/** Still open, so still cancellable. */
const OPEN = ['CREATED', 'NOTIFIED', 'APPROVED'];

export function VisitorsScreen() {
  const qc = useQueryClient();
  const { communityId } = useResidentCommunity();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);

  const units = useQuery({
    queryKey: ['gate', 'my-units'],
    queryFn: () => living.gate.myUnits(),
  });

  const visitors = useQuery({
    // communityId in the key AND the request: a resident with flats in two
    // communities must not carry the first one's list across a switch.
    queryKey: ['gate', 'mine', 'visitors', communityId],
    queryFn: () => living.gate.mine({
      communityId: communityId!, entryType: 'VISITOR',
      limit: 50, sortBy: 'createdAt', sortDir: 'desc',
    }),
    enabled: !!communityId,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => living.gate.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate'] }),
  });

  const myUnits = units.data ?? [];
  const rows = visitors.data?.items ?? [];
  const canInvite = myUnits.length > 0;

  const onCancel = async (v: GateEntry) => {
    if (!(await confirm({ title: `Cancel the visit for ${v.personName}?`, confirmLabel: 'Cancel visit' }))) return;
    try {
      await cancel.mutateAsync(v.id);
      toast.success('Cancelled');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not cancel');
    }
  };

  return (
    <div>
      <ScreenHeader
        title="Visitors"
        subtitle="Living"
        right={canInvite ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Invite</Button> : undefined}
      />
      <div className="mt-2 flex flex-col gap-2 px-4">
        {visitors.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No visitors yet"
            description={canInvite
              ? 'Invite a guest to generate a gate pass.'
              : 'Ask management to link your account to a unit before inviting visitors.'}
          />
        ) : (
          rows.map((v) => (
            <div key={v.id} className="rounded-card bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-strong">{v.personName}</p>
                  <p className="text-xs text-muted">
                    {v.unit?.unitNumber ? `${v.unit.unitNumber} · ` : ''}
                    {formatDateTime(v.expectedArrival ?? v.createdAt)}
                  </p>
                </div>
                <Badge tone={TONE[v.status] ?? 'neutral'} size="sm" dot>{humanize(v.status)}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {v.passCode ? (
                  <div className="rounded-md bg-sunken px-3 py-1 font-mono text-sm font-bold tracking-widest text-brand">{v.passCode}</div>
                ) : <span />}
                {OPEN.includes(v.status) && (
                  <button onClick={() => void onCancel(v)} className="text-xs text-danger-fg">Cancel</button>
                )}
              </div>
              {v.decisionNote && <p className="mt-2 text-xs text-subtle">{v.decisionNote}</p>}
            </div>
          ))
        )}
      </div>
      {canInvite && (
        <InviteSheet
          open={creating}
          onOpenChange={setCreating}
          units={myUnits.filter((u) => !communityId || u.communityId === communityId)}
        />
      )}
    </div>
  );
}

function InviteSheet({
  open, onOpenChange, units,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: { id: string; unitNumber: string; block?: { name: string } | null }[];
}) {
  const qc = useQueryClient();
  const [unitId, setUnitId] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);

  // One flat is the common case — preselect it so the field is not busywork.
  const only = units.length === 1 ? units[0]!.id : '';
  useEffect(() => { if (only && !unitId) setUnitId(only); }, [only, unitId]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function submit() {
    if (!unitId) { toast.error('Choose which flat the visitor is coming to'); return; }
    if (!name.trim() || !mobile.trim() || !date) { toast.error('Name, mobile and date are required'); return; }
    setBusy(true);
    try {
      await living.gate.inviteVisitor({
        unitId,
        personName: name.trim(),
        mobileNumber: mobile.trim(),
        vehicleNumber: vehicle.trim() || undefined,
        remarks: purpose.trim() || undefined,
        expectedArrival: new Date(`${date}T${time || '09:00'}`).toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ['gate'] });
      toast.success('Visitor invited — security has been notified');
      onOpenChange(false);
      setName(''); setMobile(''); setVehicle(''); setPurpose(''); setDate(''); setTime('');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not invite');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="bottom" title="Invite visitor" className="max-h-[88dvh]">
        <div className="flex flex-col gap-3">
          {/* Only the caller's own flats are offered, and the API refuses any
              other unit regardless — a resident invites to where they live. */}
          {units.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-strong">Visiting which flat</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none focus-visible:shadow-ring"
              >
                <option value="">Select…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.block?.name ? `${u.block.name} · ` : ''}{u.unitNumber}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Input label="Visitor name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramesh Kumar" />
          <Input label="Mobile" type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            {/* A visit cannot be announced for a day that has already passed. */}
            <Input label="Date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Input label="Purpose (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Family visit" />
          <Input label="Vehicle (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          <Button size="lg" block loading={busy} onClick={submit} className="mt-2">Generate gate pass</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
