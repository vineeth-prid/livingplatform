import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Table2, X } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { cn, formatDate } from '@living/utils';
import type { AmenityBooking } from '@living/types';
import { Badge, type BadgeProps, Button, Card, EmptyState, Skeleton, toast, useConfirm } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { useResidentOptions } from '../visitors/lib';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = { PENDING: 'info', CONFIRMED: 'brand', CANCELLED: 'neutral', COMPLETED: 'success' };
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();
const BStatus = ({ status }: { status: string }) => <Badge tone={TONE[status] ?? 'neutral'} size="sm" dot>{humanize(status)}</Badge>;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const residentName = (b: AmenityBooking) => b.resident ? `${b.resident.firstName} ${b.resident.lastName}` : '—';

function toParams(p: Record<string, unknown>): Record<string, unknown> {
  const { date, ...rest } = p;
  if (typeof date === 'string' && date) { rest.dateFrom = new Date(date + 'T00:00:00').toISOString(); rest.dateTo = new Date(date + 'T23:59:59').toISOString(); }
  return rest;
}

function useCancel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => living.bookings.cancel(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['bookings'] }); toast.success('Booking cancelled'); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Could not cancel'),
  });
}

export function BookingsPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const residentsQ = useResidentOptions(communityId);
  const amenitiesQ = useQuery({ queryKey: ['amenities', communityId, 'options'], queryFn: () => living.amenities.list(communityId!, { limit: 200 }), enabled: !!communityId });
  const cancel = useCancel();
  const canCancel = hasPermission('booking:cancel') || hasPermission('booking:update');

  const list = useListQuery<AmenityBooking>({
    queryKey: ['bookings', communityId ?? ''],
    basePath: '/bookings',
    filterKeys: ['residentId', 'amenityId', 'status', 'date'],
    defaultSort: 'bookingDate',
    enabled: !!communityId,
    fetch: (params) => living.bookings.list({ communityId: communityId!, ...toParams(params) }),
  });

  const onCancel = async (b: AmenityBooking) => {
    if (!(await confirm({ title: 'Cancel this booking?', tone: 'danger', confirmLabel: 'Cancel booking' }))) return;
    cancel.mutate(b.id);
  };

  const columns: ListColumn<AmenityBooking>[] = [
    { key: 'amenity', header: 'Amenity', cell: (b) => <p className="font-medium text-strong">{b.amenity?.name ?? '—'}</p> },
    { key: 'resident', header: 'Resident', cell: (b) => <span className="text-sm text-body">{residentName(b)}</span> },
    { key: 'date', header: 'Date', sortKey: 'bookingDate', cell: (b) => <span className="text-sm text-body">{formatDate(b.bookingDate)}</span> },
    { key: 'slot', header: 'Slot', cell: (b) => <span className="text-sm text-muted">{time(b.startTime)}–{time(b.endTime)}</span> },
    { key: 'status', header: 'Status', cell: (b) => <BStatus status={b.status} /> },
    { key: 'actions', header: '', align: 'right', cell: (b) => canCancel && (b.status === 'PENDING' || b.status === 'CONFIRMED') ? <div onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" onClick={() => onCancel(b)}><X className="h-4 w-4" /> Cancel</Button></div> : null },
  ];

  return (
    <ListScaffold
      title="Bookings"
      description="Amenity reservations across the community."
      query={list}
      columns={columns}
      rowKey={(b) => b.id}
      searchPlaceholder="Search bookings…"
      filters={[
        { key: 'amenityId', placeholder: 'All amenities', options: (amenitiesQ.data?.items ?? []).map((a) => ({ value: a.id, label: a.name })) },
        { key: 'residentId', placeholder: 'All residents', options: (residentsQ.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` })) },
        { key: 'status', placeholder: 'All statuses', options: opt(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) },
      ]}
      headerActions={
        <div role="radiogroup" aria-label="View" className="inline-flex items-center gap-0.5 rounded-pill bg-sunken p-0.5">
          {([['table', Table2, 'Table'], ['calendar', CalendarDays, 'Calendar']] as const).map(([v, Icon, label]) => (
            <button key={v} role="radio" aria-checked={view === v} aria-label={label} onClick={() => setView(v)}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors', view === v ? 'bg-card text-strong shadow-xs' : 'text-subtle hover:text-body')}><Icon className="h-4 w-4" /></button>
          ))}
        </div>
      }
      renderContent={view === 'calendar' ? <CalendarView bookings={list.items} loading={list.isLoading} onCancel={canCancel ? onCancel : undefined} /> : undefined}
    />
  );
}

/** A day-grouped agenda of bookings (newest day first). */
function CalendarView({ bookings, loading, onCancel }: { bookings: AmenityBooking[]; loading: boolean; onCancel?: (b: AmenityBooking) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, AmenityBooking[]>();
    for (const b of [...bookings].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())) {
      const day = b.bookingDate.slice(0, 10);
      (map.get(day) ?? map.set(day, []).get(day)!).push(b);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [bookings]);

  if (loading) return <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}</div>;
  if (groups.length === 0) return <EmptyState icon={CalendarDays} title="No bookings" description="Reservations will appear here." />;

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([day, items]) => (
        <div key={day}>
          <p className="mb-2 text-sm font-semibold text-strong">{formatDate(day)}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => (
              <Card key={b.id} variant="elevated" className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between"><p className="truncate font-medium text-strong">{b.amenity?.name ?? 'Amenity'}</p><BStatus status={b.status} /></div>
                <p className="text-sm text-muted">{time(b.startTime)}–{time(b.endTime)} · {residentName(b)}</p>
                {onCancel && (b.status === 'PENDING' || b.status === 'CONFIRMED') && <Button size="sm" variant="ghost" className="self-start" onClick={() => onCancel(b)}><X className="h-4 w-4" /> Cancel</Button>}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
