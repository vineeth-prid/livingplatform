import { useState } from 'react';
import { CalendarClock, LayoutGrid, ListChecks, Megaphone, PhoneCall, Plus, Users } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { timeAgo } from '@living/utils';
import { EmptyState, Skeleton } from '@living/ui';

import { useResidentCommunity } from '../community';
import { useMyRequests } from '../queries';
import { CreateRequestSheet } from '../create-request-sheet';
import { ListCard, QuickAction, Section, SoftPlaceholder, StatusPill } from '../components';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomeScreen() {
  const { session } = useAuth();
  const { community } = useResidentCommunity();
  const { open, items, isLoading } = useMyRequests();
  const [complaint, setComplaint] = useState(false);

  return (
    <div className="px-4">
      {/* Warm hero */}
      <div className="pb-4 pt-8">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">{community?.name ?? 'Living'}</p>
        <h1 className="mt-1 font-display text-h1 leading-tight tracking-tight text-strong">
          {greeting()}{session?.user.firstName ? `, ${session.user.firstName}` : ''}.
        </h1>
      </div>

      <Section title="Announcements">
        <SoftPlaceholder icon={Megaphone} title="No announcements right now" note="Community updates will appear here." />
      </Section>

      <Section title="Open requests" action={<span className="font-mono text-sm text-subtle" data-numeric>{open.length}</span>}>
        {isLoading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-card" />)}</div>
        ) : open.length === 0 ? (
          <EmptyState title="Nothing open" description="You’re all caught up." />
        ) : (
          <div className="flex flex-col gap-2">
            {open.slice(0, 3).map((r) => (
              <ListCard key={r.id} to={r.detailPath}
                title={r.title}
                subtitle={<span className="font-mono">{r.number}</span>}
                trailing={<StatusPill status={r.status} />} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Upcoming bookings">
        <SoftPlaceholder icon={CalendarClock} title="No bookings yet" note="Amenity bookings arrive soon." />
      </Section>

      <Section title="Quick actions">
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction icon={Plus} label="Raise complaint" onClick={() => setComplaint(true)} />
          <QuickAction icon={LayoutGrid} label="Book service" to="/services" />
          <QuickAction icon={ListChecks} label="My requests" to="/requests" />
          <QuickAction icon={Users} label="Directory" to="/community" />
          <QuickAction icon={PhoneCall} label="Emergency" to="/community" />
        </div>
      </Section>

      <Section title="Recent activity">
        {isLoading ? (
          <Skeleton className="h-16 rounded-card" />
        ) : items.length === 0 ? (
          <EmptyState title="No activity yet" description="Your requests will show up here." />
        ) : (
          <div className="flex flex-col gap-2">
            {items.slice(0, 4).map((r) => (
              <ListCard key={r.id} to={r.detailPath}
                title={r.title}
                subtitle={`${r.kind === 'ticket' ? 'Complaint' : 'Service'} · ${timeAgo(r.createdAt)}`}
                trailing={<StatusPill status={r.status} />} />
            ))}
          </div>
        )}
      </Section>

      <CreateRequestSheet open={complaint} onOpenChange={setComplaint} mode="complaint" />
    </div>
  );
}
