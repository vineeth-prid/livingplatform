import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { formatDate } from '@living/utils';
import { Badge, type BadgeProps, EmptyState, Skeleton, toast, useConfirm } from '@living/ui';
import { cn } from '@living/utils';
import type { AmenityBooking } from '@living/types';

import { useBookingMutations, useMyBookings } from '../community-ops';
import { ScreenHeader } from '../shell';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = { PENDING: 'info', CONFIRMED: 'brand', CANCELLED: 'neutral', COMPLETED: 'success' };
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function BookingsScreen() {
  const { data, isLoading } = useMyBookings();
  const { cancel } = useBookingMutations();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const now = Date.now();

  const filtered = useMemo(() => {
    const all = data?.items ?? [];
    if (tab === 'cancelled') return all.filter((b) => b.status === 'CANCELLED');
    if (tab === 'past') return all.filter((b) => b.status === 'COMPLETED' || (b.status !== 'CANCELLED' && new Date(b.endTime).getTime() < now));
    return all.filter((b) => (b.status === 'CONFIRMED' || b.status === 'PENDING') && new Date(b.endTime).getTime() >= now);
  }, [data, tab, now]);

  const onCancel = async (b: AmenityBooking) => {
    if (!(await confirm({ title: 'Cancel this booking?', confirmLabel: 'Cancel booking' }))) return;
    try { await cancel.mutateAsync(b.id); toast.success('Cancelled'); } catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not cancel'); }
  };

  return (
    <div>
      <ScreenHeader title="My bookings" subtitle="Living" />
      <div className="flex gap-1.5 px-4">
        {(['upcoming', 'past', 'cancelled'] as const).map((v) => (
          <button key={v} onClick={() => setTab(v)} className={cn('flex-1 rounded-pill px-3 py-1.5 text-sm font-medium capitalize transition-colors', tab === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted')}>{v}</button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 px-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
        ) : filtered.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={`No ${tab} bookings`} description={tab === 'upcoming' ? 'Book an amenity to see it here.' : undefined} />
        ) : (
          filtered.map((b) => (
            <div key={b.id} className="rounded-card bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-medium text-strong">{b.amenity?.name ?? 'Amenity'}</p><p className="text-xs text-muted">{formatDate(b.bookingDate)} · {time(b.startTime)}–{time(b.endTime)}</p></div>
                <Badge tone={TONE[b.status] ?? 'neutral'} size="sm" dot>{humanize(b.status)}</Badge>
              </div>
              {tab === 'upcoming' && <button onClick={() => onCancel(b)} className="mt-2 text-xs text-danger-fg">Cancel booking</button>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
