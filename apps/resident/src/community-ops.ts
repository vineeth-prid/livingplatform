import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';

import { useResidentCommunity } from './community';
import { living } from './lib/living';

/**
 * The signed-in resident's own record — their residentId (needed to create
 * visitors and bookings), the unit(s) they live in, and their household.
 *
 * This used to scan the community's resident list, which a plain resident is
 * not allowed to read (`resident:read` is a manager permission): the request
 * 403'd, residentId stayed null, and every "Book"/"Invite" button was hidden.
 * `/residents/me` is self-scoped and needs no permission.
 */
export function useMyResident() {
  const { session } = useAuth();
  const q = useQuery({
    queryKey: ['my-resident', session?.user.id],
    queryFn: () => living.people.myResident(),
    enabled: !!session?.user.id,
  });

  const residents = q.data?.residents ?? [];
  const primary = residents[0] ?? null;
  const units = residents
    .map((r) => r.unitAssignment?.unit)
    .filter((u): u is NonNullable<typeof u> => !!u);

  return {
    resident: primary,
    residentId: primary?.id ?? null,
    residents,
    units,
    family: q.data?.family ?? [],
    isLoading: q.isLoading,
  };
}

export function useFamilyMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['my-resident'] });
  return {
    add: useMutation({
      mutationFn: (input: { firstName: string; lastName?: string; mobile: string }) =>
        living.people.addFamilyMember(input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => living.people.removeFamilyMember(id),
      onSuccess: invalidate,
    }),
  };
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
