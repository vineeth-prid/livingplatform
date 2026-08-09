import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';
import type { Community } from '@living/types';

import { living } from './lib/living';

interface CommunityValue {
  community: Community | null;
  communityId: string | null;
  /** Every community this resident belongs to. One entry is the common case. */
  communities: Community[];
  setCommunityId: (id: string) => void;
  isLoading: boolean;
}

const Ctx = createContext<CommunityValue | null>(null);
const STORAGE_KEY = 'living.resident.community';

/**
 * The community this resident is currently looking at.
 *
 * One person can belong to several — an owner with flats in two societies, or
 * someone who moved and kept their number. The list comes back from the API
 * already scoped to the communities they hold a grant in, so everything here is
 * a choice between places that are genuinely theirs.
 *
 * The choice is persisted: a resident opening the app expects the flat they
 * were last looking at, not whichever one sorts first.
 */
export function CommunityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: () => living.community.list({ limit: 20, sortDir: 'asc', sortBy: 'name' }),
    enabled: isAuthenticated,
  });

  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null),
  );

  const communities = useMemo(() => data?.items ?? [], [data]);

  const community = useMemo(() => {
    if (communities.length === 0) return null;
    // A remembered community that no longer exists (access removed, community
    // archived) must fall back rather than leave the app on a dead id.
    const persisted = communities.find((c) => c.id === selectedId);
    if (persisted) return persisted;
    return communities.find((c) => c.status === 'ACTIVE') ?? communities[0] ?? null;
  }, [communities, selectedId]);

  useEffect(() => {
    if (community && community.id !== selectedId) {
      setSelectedId(community.id);
      window.localStorage.setItem(STORAGE_KEY, community.id);
    }
  }, [community, selectedId]);

  const setCommunityId = (id: string) => {
    setSelectedId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo<CommunityValue>(
    () => ({
      community,
      communityId: community?.id ?? null,
      communities,
      setCommunityId,
      isLoading,
    }),
    [community, communities, isLoading],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useResidentCommunity(): CommunityValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useResidentCommunity must be used within CommunityProvider');
  return ctx;
}
