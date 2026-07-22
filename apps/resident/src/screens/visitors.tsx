import { useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Badge, type BadgeProps, Button, EmptyState, Input, Sheet, SheetContent, Skeleton, toast, useConfirm } from '@living/ui';
import { cn } from '@living/utils';
import type { Visitor } from '@living/types';

import { useResidentCommunity } from '../community';
import { useMyResidentId, useMyVisitors, useVisitorMutations } from '../community-ops';
import { ScreenHeader } from '../shell';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = { PENDING: 'info', APPROVED: 'brand', CHECKED_IN: 'warning', CHECKED_OUT: 'success', REJECTED: 'danger' };
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const VTYPES = ['GUEST', 'DELIVERY', 'SERVICE', 'CAB', 'OTHER'] as const;

export function VisitorsScreen() {
  const { data, isLoading } = useMyVisitors();
  const { residentId } = useMyResidentId();
  const { cancel } = useVisitorMutations();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const visitors = data?.items ?? [];

  const onCancel = async (v: Visitor) => {
    if (!(await confirm({ title: `Cancel visit for ${v.visitorName}?`, confirmLabel: 'Cancel visit' }))) return;
    try { await cancel.mutateAsync(v.id); toast.success('Cancelled'); } catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not cancel'); }
  };

  return (
    <div>
      <ScreenHeader title="Visitors" subtitle="Living" right={residentId ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Invite</Button> : undefined} />
      <div className="mt-2 flex flex-col gap-2 px-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
        ) : visitors.length === 0 ? (
          <EmptyState icon={UserRound} title="No visitors yet" description={residentId ? 'Invite a guest to generate a gate pass.' : 'Ask management to link your account to invite visitors.'} />
        ) : (
          visitors.map((v) => (
            <div key={v.id} className="rounded-card bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-medium text-strong">{v.visitorName}</p><p className="text-xs text-muted">{humanize(v.visitorType)} · {formatDateTime(v.expectedArrival)}</p></div>
                <Badge tone={TONE[v.status] ?? 'neutral'} size="sm" dot>{humanize(v.status)}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="rounded-md bg-sunken px-3 py-1 font-mono text-sm font-bold tracking-widest text-brand">{v.passCode}</div>
                {(v.status === 'PENDING' || v.status === 'APPROVED') && <button onClick={() => onCancel(v)} className="text-xs text-danger-fg">Cancel</button>}
              </div>
            </div>
          ))
        )}
      </div>
      {residentId && <InviteSheet open={creating} onOpenChange={setCreating} residentId={residentId} />}
    </div>
  );
}

function InviteSheet({ open, onOpenChange, residentId }: { open: boolean; onOpenChange: (o: boolean) => void; residentId: string }) {
  const { communityId } = useResidentCommunity();
  const { create } = useVisitorMutations();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [type, setType] = useState('GUEST');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !mobile.trim() || !date) { toast.error('Name, mobile and date are required'); return; }
    setBusy(true);
    try {
      await create.mutateAsync({
        communityId, residentId, visitorName: name.trim(), mobileNumber: mobile.trim(),
        vehicleNumber: vehicle.trim() || undefined, visitorType: type,
        expectedArrival: new Date(`${date}T${time || '09:00'}`).toISOString(),
      });
      toast.success('Visitor invited');
      onOpenChange(false); setName(''); setMobile(''); setVehicle(''); setDate(''); setTime('');
    } catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not invite'); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="bottom" title="Invite visitor" className="max-h-[88dvh]">
        <div className="flex flex-col gap-3">
          <Input label="Visitor name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramesh Kumar" />
          <Input label="Mobile" type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Type</span>
            <div className="flex flex-wrap gap-1.5">
              {VTYPES.map((t) => <button key={t} onClick={() => setType(t)} className={cn('rounded-pill px-3 py-1.5 text-sm', type === t ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted')}>{humanize(t)}</button>)}
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Input label="Vehicle (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          <Button size="lg" block loading={busy} onClick={submit} className="mt-2">Generate gate pass</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
