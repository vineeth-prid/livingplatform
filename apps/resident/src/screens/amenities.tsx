import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, Clock, Hourglass, ListChecks, MapPin, Sparkles, Users } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { Button, EmptyState, Input, Sheet, SheetContent, Skeleton, toast } from '@living/ui';
import type { Amenity } from '@living/types';

import { useResidentCommunity } from '../community';
import { useBookableAmenities, useBookingMutations, useMyResident } from '../community-ops';
import { ScreenHeader } from '../shell';

/** `operatingHours` is a JSON column, so it arrives untyped and may be partial. */
function operatingHours(
  amenity: Amenity,
): { openingTime: string; closingTime: string } | null {
  const hours = amenity.operatingHours as
    | { openingTime?: string | null; closingTime?: string | null }
    | null
    | undefined;
  if (!hours?.openingTime || !hours.closingTime) return null;
  return { openingTime: hours.openingTime, closingTime: hours.closingTime };
}

/** "2h 30m" / "45m" — mirrors the API's wording so the two never disagree. */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Compact "Open 06:00–22:00" line for the amenity list. */
function openingLabel(amenity: Amenity): string | null {
  const hours = operatingHours(amenity);
  return hours ? `Open ${hours.openingTime}–${hours.closingTime}` : null;
}

export function AmenitiesScreen() {
  const { data, isLoading } = useBookableAmenities();
  const { residentId } = useMyResident();
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
              {/* Category AND location, not one or the other — an admin who
                  fills both expects to see both, and "Sports · Clubhouse L1"
                  tells a resident more than either alone. */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-strong">{a.name}</p>
                <p className="truncate text-xs text-muted">
                  {[a.category, a.location].filter(Boolean).join(' · ') || 'Community amenity'}
                  {a.capacity ? ` · ${a.capacity} cap` : ''}
                </p>
                {openingLabel(a) && (
                  <p className="truncate text-2xs text-subtle">{openingLabel(a)}</p>
                )}
              </div>
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

    // Check the rules the resident can already see, before the round-trip. The
    // API enforces all of these too — this only saves them a failed submit.
    const startAt = new Date(`${date}T${start}`);
    const endAt = new Date(`${date}T${end}`);
    if (endAt <= startAt) { toast.error('End time must be after the start time'); return; }

    const hours = operatingHours(amenity);
    if (hours && (start < hours.openingTime || end > hours.closingTime)) {
      toast.error(`${amenity.name} is open ${hours.openingTime}–${hours.closingTime}`);
      return;
    }

    const max = amenity.maxBookingMinutes;
    if (max && (endAt.getTime() - startAt.getTime()) / 60000 > max) {
      toast.error(`Bookings here can be at most ${formatMinutes(max)}`);
      return;
    }

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
          {/* The rules up front. A resident should not have to discover the
              opening hours or the length cap by having a booking rejected. */}
          <div className="flex flex-col gap-1.5 rounded-control bg-sunken px-3 py-2.5 text-sm text-muted">
            {[amenity.category, amenity.location].filter(Boolean).length > 0 && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                {[amenity.category, amenity.location].filter(Boolean).join(' · ')}
              </p>
            )}
            {operatingHours(amenity) && (
              <p className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" />
                Open {operatingHours(amenity)!.openingTime}–{operatingHours(amenity)!.closingTime}
              </p>
            )}
            {amenity.maxBookingMinutes ? (
              <p className="flex items-center gap-1.5">
                <Hourglass className="h-4 w-4 shrink-0" />
                Up to {formatMinutes(amenity.maxBookingMinutes)} per booking
              </p>
            ) : null}
            {amenity.capacity ? (
              <p className="flex items-center gap-1.5">
                <Users className="h-4 w-4 shrink-0" /> Capacity {amenity.capacity}
              </p>
            ) : null}
          </div>
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
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
