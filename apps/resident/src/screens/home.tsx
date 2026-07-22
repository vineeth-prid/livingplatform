import { useMemo, useState } from 'react';
import { CalendarClock, CalendarPlus, LayoutGrid, Megaphone, Plus, UserRound } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { formatDate, timeAgo } from '@living/utils';
import { Badge, EmptyState, Skeleton } from '@living/ui';

import { useResidentCommunity } from '../community';
import { useMyRequests } from '../queries';
import { useAnnouncements, useMyBookings, useMyVisitors } from '../community-ops';
import { CreateRequestSheet } from '../create-request-sheet';
import { ListCard, QuickAction, Section, SoftPlaceholder, StatusPill } from '../components';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function HomeScreen() {
  const { session } = useAuth();
  const { community } = useResidentCommunity();
  const { open, items, isLoading } = useMyRequests();
  const announcements = useAnnouncements();
  const bookings = useMyBookings();
  const visitors = useMyVisitors();
  const [complaint, setComplaint] = useState(false);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return (bookings.data?.items ?? []).filter((b) => (b.status === 'CONFIRMED' || b.status === 'PENDING') && new Date(b.endTime).getTime() >= now).slice(0, 2);
  }, [bookings.data]);
  const recentVisitors = (visitors.data?.items ?? []).slice(0, 2);
  const topAnnouncements = (announcements.data?.items ?? []).slice(0, 2);

  return (
    <div className="px-4">
      <div className="pb-4 pt-8">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">{community?.name ?? 'Living'}</p>
        <h1 className="mt-1 font-display text-h1 leading-tight tracking-tight text-strong">{greeting()}{session?.user.firstName ? `, ${session.user.firstName}` : ''}.</h1>
      </div>

      <Section title="Announcements" action={<span className="text-sm text-brand">See all</span>}>
        {announcements.isLoading ? (
          <Skeleton className="h-16 rounded-card" />
        ) : topAnnouncements.length === 0 ? (
          <SoftPlaceholder icon={Megaphone} title="No announcements right now" note="Community updates will appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            {topAnnouncements.map((a) => (
              <ListCard key={a.id} to={'/announcements' as string} title={a.title} subtitle={a.publishAt ? timeAgo(a.publishAt) : undefined}
                trailing={a.priority === 'CRITICAL' || a.priority === 'HIGH' ? <Badge tone={a.priority === 'CRITICAL' ? 'danger' : 'warning'} size="sm" dot>{a.priority.toLowerCase()}</Badge> : undefined} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Open requests" action={<span className="font-mono text-sm text-subtle" data-numeric>{open.length}</span>}>
        {isLoading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-card" />)}</div>
        ) : open.length === 0 ? (
          <EmptyState title="Nothing open" description="You’re all caught up." />
        ) : (
          <div className="flex flex-col gap-2">{open.slice(0, 3).map((r) => <ListCard key={r.id} to={r.detailPath} title={r.title} subtitle={<span className="font-mono">{r.number}</span>} trailing={<StatusPill status={r.status} />} />)}</div>
        )}
      </Section>

      <Section title="Upcoming bookings" action={<span className="text-sm text-brand">Book</span>}>
        {bookings.isLoading ? (
          <Skeleton className="h-16 rounded-card" />
        ) : upcomingBookings.length === 0 ? (
          <SoftPlaceholder icon={CalendarClock} title="No upcoming bookings" note="Reserve an amenity from the Amenities page." />
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingBookings.map((b) => <ListCard key={b.id} to={'/bookings' as string} title={b.amenity?.name ?? 'Amenity'} subtitle={`${formatDate(b.bookingDate)} · ${time(b.startTime)}`} trailing={<StatusPill status={b.status} />} />)}
          </div>
        )}
      </Section>

      <Section title="Recent visitors">
        {visitors.isLoading ? (
          <Skeleton className="h-16 rounded-card" />
        ) : recentVisitors.length === 0 ? (
          <SoftPlaceholder icon={UserRound} title="No visitors yet" note="Invite a guest to generate a gate pass." />
        ) : (
          <div className="flex flex-col gap-2">
            {recentVisitors.map((v) => <ListCard key={v.id} to={'/visitors' as string} title={v.visitorName} subtitle={<span className="font-mono">{v.passCode}</span>} trailing={<StatusPill status={v.status} />} />)}
          </div>
        )}
      </Section>

      <Section title="Quick actions">
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction icon={Plus} label="Raise complaint" onClick={() => setComplaint(true)} />
          <QuickAction icon={UserRound} label="Invite visitor" to="/visitors" />
          <QuickAction icon={CalendarPlus} label="Book amenity" to="/amenities" />
          <QuickAction icon={Megaphone} label="Announcements" to="/announcements" />
          <QuickAction icon={LayoutGrid} label="Services" to="/services" />
        </div>
      </Section>

      <Section title="Recent activity">
        {isLoading ? (
          <Skeleton className="h-16 rounded-card" />
        ) : items.length === 0 ? (
          <EmptyState title="No activity yet" description="Your requests will show up here." />
        ) : (
          <div className="flex flex-col gap-2">{items.slice(0, 4).map((r) => <ListCard key={r.id} to={r.detailPath} title={r.title} subtitle={`${r.kind === 'ticket' ? 'Complaint' : 'Service'} · ${timeAgo(r.createdAt)}`} trailing={<StatusPill status={r.status} />} />)}</div>
        )}
      </Section>

      <CreateRequestSheet open={complaint} onOpenChange={setComplaint} mode="complaint" />
    </div>
  );
}
