import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, ListChecks, Sparkles, Users } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { Button, EmptyState, Input, Sheet, SheetContent, Skeleton, toast } from '@living/ui';
import type { Amenity } from '@living/types';

import { useResidentCommunity } from '../community';
import { useBookableAmenities, useBookingMutations, useMyResidentId } from '../community-ops';
import { ScreenHeader } from '../shell';

export function AmenitiesScreen() {
  const { data, isLoading } = useBookableAmenities();
  const { residentId } = useMyResidentId();
  const [booking, setBooking] = useState<Amenity | null>(null);
  const amenities = data?.items ?? [];

  return (
    <div>
      <ScreenHeader title="Amenities" subtitle="Living" right={<Link to={'/bookings' as string} className="inline-flex items-center gap-1 text-sm text-brand"><ListChecks className="h-4 w-4" /> My bookings</Link>} />
      <div className="mt-2 flex flex-col gap-2 px-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
        ) : amenities.length === 0 ? (
          <EmptyState icon={Sparkles} title="No bookable amenities" description="Bookable facilities will appear here." />
        ) : (
          amenities.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-card bg-card p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand"><Sparkles className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-strong">{a.name}</p><p className="truncate text-xs text-muted">{a.location ?? a.category ?? 'Community amenity'}{a.capacity ? ` · ${a.capacity} cap` : ''}</p></div>
              {residentId && <Button size="sm" onClick={() => setBooking(a)}><CalendarPlus className="h-4 w-4" /> Book</Button>}
            </div>
          ))
        )}
        {!residentId && !isLoading && amenities.length > 0 && <p className="px-1 text-xs text-subtle">Ask management to link your account to book amenities.</p>}
      </div>
      {residentId && booking && <BookSheet amenity={booking} residentId={residentId} open={!!booking} onOpenChange={(o) => !o && setBooking(null)} />}
    </div>
  );
}

function BookSheet({ amenity, residentId, open, onOpenChange }: { amenity: Amenity; residentId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { communityId } = useResidentCommunity();
  const { create } = useBookingMutations();
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!date || !start || !end) { toast.error('Choose a date and time'); return; }
    setBusy(true);
    try {
      await create.mutateAsync({
        communityId, amenityId: amenity.id, residentId,
        startTime: new Date(`${date}T${start}`).toISOString(), endTime: new Date(`${date}T${end}`).toISOString(),
      });
      toast.success('Booked');
      onOpenChange(false);
    } catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not book'); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="bottom" title={`Book ${amenity.name}`} className="max-h-[80dvh]">
        <div className="flex flex-col gap-3">
          {amenity.capacity && <p className="flex items-center gap-1.5 text-sm text-muted"><Users className="h-4 w-4" /> Capacity {amenity.capacity}</p>}
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input label="To" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <Button size="lg" block loading={busy} onClick={submit} className="mt-2">Confirm booking</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
