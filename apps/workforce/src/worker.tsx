import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';
import type { Community, Staff, Vendor } from '@living/types';

import { living } from './lib/living';

/**
 * Resolves WHO the logged-in worker is in operational terms: their community and
 * their staff/vendor profile id — because jobs are assigned to a Staff or Vendor
 * (assignedStaffId / assignedVendorId), never directly to a User.
 *
 * Identity comes from the self-scoped `/staff/me` and `/vendors/me` endpoints.
 *
 * This used to scan the community's staff list and the tenant's vendor list for
 * a matching `userId` — but those lists require `staff:read` / `vendor:read`,
 * which the STAFF and VENDOR roles deliberately do NOT hold. Every request
 * 403'd, nothing matched, and every worker was met with "we couldn't match your
 * login to a staff or vendor profile" no matter how correctly their account was
 * set up. The `me` endpoints need no permission because they are scoped to the
 * caller's own user id.
 *
 * The community is taken from the staff record itself where possible, so a
 * staff member in a community that is not the tenant's first is resolved
 * correctly rather than silently mismatched.
 *
 * ponytail: still no "my assignments" endpoint, so jobs are filtered client-side
 * by staffId/vendorId. Vendors remain tenant-scoped (they span communities).
 */
interface WorkerValue {
  community: Community | null;
  communityId: string | null;
  staff: Staff | null;
  vendor: Vendor | null;
  /** The assignee ids used to filter "my jobs". */
  staffId: string | null;
  vendorId: string | null;
  /** The login id — a work order this person RAISED is theirs to follow even
   *  before anyone is assigned to it. */
  userId: string | null;
  /** Every community this worker holds a profile in. One is the common case. */
  communities: Community[];
  setCommunityId: (id: string) => void;
  isLinked: boolean;
  isLoading: boolean;
}

const Ctx = createContext<WorkerValue | null>(null);

const STORAGE_KEY = 'living.workforce.community';

export function WorkerProvider({ children }: { children: ReactNode }) {
  const { session, isAuthenticated } = useAuth();
  const uid = session?.user.id;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null),
  );

  const setCommunityId = (id: string) => {
    setSelectedId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  };

  const communityQ = useQuery({
    queryKey: ['communities'],
    queryFn: () => living.community.list({ limit: 20, sortDir: 'asc', sortBy: 'name' }),
    enabled: isAuthenticated,
  });

  const [staffQ, vendorQ] = useQueries({
    queries: [
      {
        queryKey: ['my', 'staff'],
        queryFn: () => living.people.myStaff(),
        enabled: isAuthenticated && !!uid,
      },
      {
        queryKey: ['my', 'vendor'],
        queryFn: () => living.people.myVendor(),
        enabled: isAuthenticated && !!uid,
      },
    ],
  });

  const value = useMemo<WorkerValue>(() => {
    const allStaff = staffQ.data?.items ?? [];
    const vendor = vendorQ.data?.items?.[0] ?? null;
    const communities = communityQ.data?.items ?? [];

    /*
      The community being worked, and the profile that belongs to it.

      A staff member can now hold a profile in several communities — a
      supervisor covering three sites, or someone who moved. Taking items[0]
      pinned them to whichever came back first, so the other communities' jobs
      and gate register were unreachable even though the API would serve them.

      A remembered choice that is no longer theirs falls back rather than
      leaving the app on a dead id.
    */
    const chosen = communities.find((c) => c.id === selectedId) ?? null;
    const community =
      chosen ??
      (allStaff[0] && communities.find((c) => c.id === allStaff[0]!.communityId)) ??
      communities.find((c) => c.status === 'ACTIVE') ??
      communities[0] ??
      null;

    // The staff profile FOR that community — the one whose jobs we show.
    const staff =
      (community && allStaff.find((s) => s.communityId === community.id)) ?? allStaff[0] ?? null;

    return {
      community,
      communityId: community?.id ?? null,
      staff,
      vendor,
      staffId: staff?.id ?? null,
      vendorId: vendor?.id ?? null,
      userId: uid ?? null,
      communities,
      setCommunityId,
      isLinked: !!staff || !!vendor,
      isLoading: communityQ.isLoading || staffQ.isLoading || vendorQ.isLoading,
    };
  }, [communityQ.data, communityQ.isLoading, staffQ.data, staffQ.isLoading, vendorQ.data, vendorQ.isLoading, selectedId, uid]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorker(): WorkerValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorker must be used within WorkerProvider');
  return ctx;
}
