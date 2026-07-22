import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';

import { useResidentCommunity } from './community';
import { living } from './lib/living';

/**
 * The resident's own resident-profile id, needed to create visitors/bookings.
 * There is no "my resident" endpoint, so we resolve it from the community's
 * resident list (best-effort — degrades gracefully if the account can't read it).
 */
export function useMyResidentId(): { residentId: string | null; isResolving: boolean } {
  const { session } = useAuth();
  const { communityId } = useResidentCommunity();
  const q = useQuery({
    queryKey: ['my-resident', communityId, session?.user.id],
    queryFn: () => living.people.listResidents(communityId!, { limit: 200 }),
    enabled: !!communityId && !!session?.user.id,
    retry: false,
  });
  const mine = (q.data?.items ?? []).find((r) => r.userId === session?.user.id);
  return { residentId: mine?.id ?? null, isResolving: q.isLoading };
}

export function useAnnouncements() {
  const { communityId } = useResidentCommunity();
  return useQuery({
    queryKey: ['announcements', communityId],
    queryFn: () => living.announcements.list({ communityId: communityId!, publishedOnly: true, limit: 30, sortBy: 'publishAt', sortDir: 'desc' }),
    enabled: !!communityId,
  });
}

export function useMyBookings() {
  const { communityId } = useResidentCommunity();
  return useQuery({
    queryKey: ['bookings', communityId],
    queryFn: () => living.bookings.list({ communityId: communityId!, limit: 50, sortBy: 'bookingDate', sortDir: 'desc' }),
    enabled: !!communityId,
  });
}

export function useMyVisitors() {
  const { communityId } = useResidentCommunity();
  return useQuery({
    queryKey: ['visitors', communityId],
    queryFn: () => living.visitors.list({ communityId: communityId!, limit: 50, sortBy: 'expectedArrival', sortDir: 'desc' }),
    enabled: !!communityId,
  });
}

export function useBookableAmenities() {
  const { communityId } = useResidentCommunity();
  return useQuery({
    queryKey: ['amenities', communityId, 'bookable'],
    queryFn: () => living.amenities.list(communityId!, { limit: 100, isBookable: true, status: 'ACTIVE' }),
    enabled: !!communityId,
  });
}

export function useVisitorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['visitors'] });
  return {
    create: useMutation({ mutationFn: (input: Record<string, unknown>) => living.visitors.create(input), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (id: string) => living.visitors.cancel(id), onSuccess: invalidate }),
  };
}

export function useBookingMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['bookings'] });
  return {
    create: useMutation({ mutationFn: (input: Record<string, unknown>) => living.bookings.create(input), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (id: string) => living.bookings.cancel(id), onSuccess: invalidate }),
  };
}
