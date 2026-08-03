import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, LayoutGrid, Plus, UserRound, Wallet } from 'lucide-react';
import { useAuth, useCommunityFeatures } from '@living/hooks';
import { formatDate } from '@living/utils';
import { EmptyState, Skeleton } from '@living/ui';

import { useResidentCommunity } from '../community';
import { useMyBookings } from '../community-ops';
import { HeroBanner } from '../hero-banner';
import { CreateRequestSheet } from '../create-request-sheet';
import { living } from '../lib/living';
import { useMyRequests } from '../queries';
import { ListCard, QuickAction, Section, StatusPill } from '../components';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * The resident home.
 *
 * Ordered by what a resident actually opens the app for: what's happening
 * (banner), what they came to do (quick actions), then what is already in
 * flight. Sections that have nothing to say render nothing at all rather than
 * an empty placeholder — an uncluttered home is the feature.
 */
export function HomeScreen() {
  const { session } = useAuth();
  const { community, communityId } = useResidentCommunity();
  const features = useCommunityFeatures(communityId);
  const { open, isLoading } = useMyRequests();
  const bookings = useMyBookings();
  const [complaint, setComplaint] = useState(false);

  // Only genuinely upcoming bookings — a past booking is not "upcoming".
  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return (bookings.data?.items ?? [])
      .filter(
        (b) =>
          (b.status === 'CONFIRMED' || b.status === 'PENDING') &&
          new Date(b.endTime).getTime() >= now,
      )
      .slice(0, 2);
  }, [bookings.data]);

  return (
    <div className="px-4">
      <header className="pb-4 pt-8">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">
          {community?.name ?? 'Living'}
        </p>
        <h1 className="mt-1 font-display text-h1 leading-tight tracking-tight text-strong">
          {greeting()}
          {session?.user.firstName ? `, ${session.user.firstName}` : ''}.
        </h1>
      </header>

      <HeroBanner />

      {features.maintenanceBilling && <MaintenanceDueCard />}

      {/* Quick actions lead — this is what people open the app to do. */}
      <Section title="Quick actions">
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={Plus} label="Raise a complaint" onClick={() => setComplaint(true)} />
          <QuickAction icon={LayoutGrid} label="Book a service" to="/services" />
          <QuickAction icon={UserRound} label="Invite a visitor" to="/visitors" />
          <QuickAction icon={CalendarPlus} label="Book an amenity" to="/amenities" />
        </div>
      </Section>

      <Section
        title="Open requests"
        action={
          open.length > 0 ? (
            <Link to={'/requests' as string} className="text-sm text-brand">
              See all
            </Link>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-card" />
            ))}
          </div>
        ) : open.length === 0 ? (
          <EmptyState title="Nothing open" description="You’re all caught up." />
        ) : (
          <div className="flex flex-col gap-2">
            {open.slice(0, 3).map((r) => (
              <ListCard
                key={r.id}
                to={r.detailPath}
                title={r.title}
                subtitle={<span className="font-mono">{r.number}</span>}
                trailing={<StatusPill status={r.status} />}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Only when there IS one — no empty "no bookings" card on the home. */}
      {upcomingBookings.length > 0 && (
        <Section title="Upcoming booking">
          <div className="flex flex-col gap-2">
            {upcomingBookings.map((b) => (
              <ListCard
                key={b.id}
                to={'/bookings' as string}
                title={b.amenity?.name ?? 'Amenity'}
                subtitle={`${formatDate(b.bookingDate)} · ${time(b.startTime)}`}
                trailing={<StatusPill status={b.status} />}
              />
            ))}
          </div>
        </Section>
      )}

      <CreateRequestSheet open={complaint} onOpenChange={setComplaint} mode="complaint" />
    </div>
  );
}

/**
 * Outstanding maintenance, surfaced above the fold because it is the one thing
 * with a deadline. Renders nothing when the resident owes nothing, so a settled
 * account keeps a calm home screen.
 */
function MaintenanceDueCard() {
  const { communityId } = useResidentCommunity();
  const dues = useQuery({
    queryKey: ['maintenance', 'my-dues', communityId],
    queryFn: () => living.billing.myDues(communityId!),
    enabled: !!communityId,
  });

  const outstanding = dues.data?.outstanding ?? 0;
  if (dues.isLoading || outstanding <= 0) return null;

  const overdue = (dues.data?.overdueCount ?? 0) > 0;
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(outstanding);

  return (
    <Link
      to={'/maintenance' as string}
      className="mb-6 block rounded-card focus-visible:outline-none focus-visible:shadow-ring"
    >
      <div className="flex items-center gap-3 rounded-card bg-tint p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-brand">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--text-on-tint)] opacity-70">
            Maintenance {overdue ? 'overdue' : 'due'}
          </p>
          <p
            className="font-display text-h3 leading-none tracking-tight text-[var(--text-on-tint)]"
            data-numeric
          >
            {amount}
          </p>
        </div>
        <span className="text-sm font-medium text-[var(--text-on-tint)]">Pay</span>
      </div>
    </Link>
  );
}
