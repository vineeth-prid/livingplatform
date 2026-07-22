import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LogIn, LogOut, ShieldCheck, UserRound, X } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { cn } from '@living/utils';
import { Badge, type BadgeProps, Button, EmptyState, SearchInput, Skeleton, toast, useConfirm } from '@living/ui';
import type { Visitor } from '@living/types';

import { living } from '../lib/living';
import { useWorker } from '../worker';
import { ScreenHeader } from '../shell';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = { PENDING: 'info', APPROVED: 'brand', CHECKED_IN: 'warning', CHECKED_OUT: 'success', REJECTED: 'danger' };
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const residentName = (v: Visitor) => v.resident ? `${v.resident.firstName} ${v.resident.lastName}` : '—';

/** The security gate: today's visitor queue, grouped, with the full lifecycle. */
export function GateScreen() {
  const { communityId, isLinked } = useWorker();
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const canOperate = hasPermission('visitor:approve') || hasPermission('visitor:checkin');

  const query = useQuery({
    queryKey: ['gate-visitors', communityId],
    queryFn: () => living.visitors.list({ communityId: communityId!, limit: 100, sortBy: 'expectedArrival', sortDir: 'asc' }),
    enabled: !!communityId && canOperate,
    refetchInterval: 30_000,
  });

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = (query.data?.items ?? []).filter((v) =>
      !needle || v.visitorName.toLowerCase().includes(needle) || v.mobileNumber.includes(needle) || v.passCode.toLowerCase().includes(needle));
    return {
      pending: all.filter((v) => v.status === 'PENDING'),
      approved: all.filter((v) => v.status === 'APPROVED'),
      in: all.filter((v) => v.status === 'CHECKED_IN'),
      out: all.filter((v) => v.status === 'CHECKED_OUT'),
    };
  }, [query.data, q]);

  if (!canOperate) {
    return (
      <div>
        <ScreenHeader title="Gate" subtitle="Security" />
        <div className="px-4"><EmptyState icon={ShieldCheck} title="No gate access" description="Your role doesn’t include visitor management." /></div>
      </div>
    );
  }

  const empty = groups.pending.length + groups.approved.length + groups.in.length + groups.out.length === 0;

  return (
    <div>
      <ScreenHeader title="Gate" subtitle="Security" />
      <div className="px-4"><SearchInput value={q} onValueChange={setQ} placeholder="Search name, mobile, pass code…" /></div>
      <div className="mt-4 flex flex-col gap-6 px-4">
        {!isLinked && !query.isLoading ? null : query.isLoading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)}</div>
        ) : empty ? (
          <EmptyState icon={UserRound} title="No visitors" description="Approved and expected visitors will appear here." />
        ) : (
          <>
            <Group title="Pending approval" visitors={groups.pending} onDone={() => query.refetch()} />
            <Group title="Expected" visitors={groups.approved} onDone={() => query.refetch()} />
            <Group title="Checked in" visitors={groups.in} onDone={() => query.refetch()} />
            <Group title="Recently out" visitors={groups.out} onDone={() => query.refetch()} muted />
          </>
        )}
      </div>
    </div>
  );
}

function Group({ title, visitors, onDone, muted }: { title: string; visitors: Visitor[]; onDone: () => void; muted?: boolean }) {
  if (visitors.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-strong">{title}<span className="rounded-full bg-sunken px-1.5 text-2xs text-muted">{visitors.length}</span></h2>
      <div className="flex flex-col gap-2">{visitors.map((v) => <GateCard key={v.id} visitor={v} onDone={onDone} muted={muted} />)}</div>
    </section>
  );
}

function GateCard({ visitor, onDone, muted }: { visitor: Visitor; onDone: () => void; muted?: boolean }) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['gate-visitors'] });
  const m = {
    approve: useMutation({ mutationFn: () => living.visitors.approve(visitor.id), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: () => living.visitors.reject(visitor.id), onSuccess: invalidate }),
    checkIn: useMutation({ mutationFn: () => living.visitors.checkIn(visitor.id), onSuccess: invalidate }),
    checkOut: useMutation({ mutationFn: () => living.visitors.checkOut(visitor.id), onSuccess: invalidate }),
  };
  const run = async (p: Promise<unknown>, ok: string) => { try { await p; toast.success(ok); onDone(); } catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Failed'); } };
  const s = visitor.status;

  return (
    <div className={cn('rounded-card bg-card p-4 shadow-sm', muted && 'opacity-70')}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><p className="truncate font-semibold text-strong">{visitor.visitorName}</p><p className="truncate text-xs text-muted">{residentName(visitor)} · {time(visitor.expectedArrival)}</p></div>
        <Badge tone={TONE[s] ?? 'neutral'} size="sm" dot>{humanize(s)}</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="rounded-md bg-sunken px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-brand">{visitor.passCode}</span>
        <div className="flex gap-2">
          {s === 'PENDING' && hasPermission('visitor:approve') && (
            <><Button size="sm" loading={m.approve.isPending} onClick={() => run(m.approve.mutateAsync(), 'Approved')}><Check className="h-4 w-4" /> Approve</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: `Reject ${visitor.visitorName}?`, tone: 'danger', confirmLabel: 'Reject' })) run(m.reject.mutateAsync(), 'Rejected'); }}><X className="h-4 w-4" /></Button></>
          )}
          {s === 'APPROVED' && hasPermission('visitor:checkin') && <Button size="sm" loading={m.checkIn.isPending} onClick={() => run(m.checkIn.mutateAsync(), 'Checked in')}><LogIn className="h-4 w-4" /> Check in</Button>}
          {s === 'CHECKED_IN' && hasPermission('visitor:checkout') && <Button size="sm" loading={m.checkOut.isPending} onClick={() => run(m.checkOut.mutateAsync(), 'Checked out')}><LogOut className="h-4 w-4" /> Check out</Button>}
        </div>
      </div>
    </div>
  );
}
