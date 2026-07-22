import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';
import type { Community, Staff, Vendor } from '@living/types';

import { living } from './lib/living';

/**
 * Resolves WHO the logged-in worker is in operational terms: their community and
 * their staff/vendor profile id — because jobs are assigned to a Staff or Vendor
 * (assignedStaffId / assignedVendorId), never directly to a User.
 *
 * There is no "my assignments" endpoint and no `assignedToMe` list filter, so we
 * resolve identity by matching the linked `userId` on the community's staff and
 * the tenant's vendors. If nothing matches (account not linked, or no read
 * grant), `isLinked` is false and the UI shows a "profile not linked" state
 * instead of silently showing an empty queue.
 *
 * ponytail: O(n) scan of staff/vendor lists (limit 200) + single active
 * community. Replace with a `/me/assignments` endpoint (or an `assignedToMe`
 * filter) and multi-community support when the backend grows them — this
 * provider is the only thing that changes.
 */
interface WorkerValue {
  community: Community | null;
  communityId: string | null;
  staff: Staff | null;
  vendor: Vendor | null;
  /** The assignee ids used to filter "my jobs". */
  staffId: string | null;
  vendorId: string | null;
  isLinked: boolean;
  isLoading: boolean;
}

const Ctx = createContext<WorkerValue | null>(null);

export function WorkerProvider({ children }: { children: ReactNode }) {
  const { session, isAuthenticated } = useAuth();
  const uid = session?.user.id;

  const communityQ = useQuery({
    queryKey: ['communities'],
    queryFn: () => living.community.list({ limit: 20, sortDir: 'asc', sortBy: 'name' }),
    enabled: isAuthenticated,
  });
  const community = useMemo(() => {
    const items = communityQ.data?.items ?? [];
    return items.find((c) => c.status === 'ACTIVE') ?? items[0] ?? null;
  }, [communityQ.data]);
  const communityId = community?.id ?? null;

  const [staffQ, vendorQ] = useQueries({
    queries: [
      {
        queryKey: ['my', 'staff', communityId],
        queryFn: () => living.people.listStaff(communityId!, { limit: 200 }),
        enabled: !!communityId && !!uid,
      },
      {
        queryKey: ['my', 'vendor'],
        queryFn: () => living.people.listVendors({ limit: 200 }),
        enabled: isAuthenticated && !!uid,
      },
    ],
  });

  const value = useMemo<WorkerValue>(() => {
    const staff = (staffQ.data?.items ?? []).find((s) => s.userId === uid) ?? null;
    const vendor = (vendorQ.data?.items ?? []).find((v) => v.userId === uid) ?? null;
    const isLoading =
      communityQ.isLoading || staffQ.isLoading || vendorQ.isLoading;
    return {
      community,
      communityId,
      staff,
      vendor,
      staffId: staff?.id ?? null,
      vendorId: vendor?.id ?? null,
      isLinked: !!staff || !!vendor,
      isLoading,
    };
  }, [community, communityId, staffQ.data, vendorQ.data, staffQ.isLoading, vendorQ.isLoading, communityQ.isLoading, uid]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorker(): WorkerValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorker must be used within WorkerProvider');
  return ctx;
}
