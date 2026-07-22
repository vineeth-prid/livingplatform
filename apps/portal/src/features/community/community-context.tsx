import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk, useLiving } from '@living/hooks';
import type { Community } from '@living/types';

import { living } from '../../lib/living';

interface CommunityContextValue {
  communities: Community[];
  community: Community | null;
  communityId: string | null;
  setCommunityId: (id: string) => void;
  isLoading: boolean;
}

const CommunityContext = createContext<CommunityContextValue | null>(null);
const STORAGE_KEY = 'living.activeCommunity';

/**
 * Resolves the tenant's communities and holds the active one (persisted). Every
 * community-scoped feature (dashboard, tickets, …) reads `communityId` from here,
 * and the WorkspaceSwitcher writes to it. App-layer state — no package changes.
 */
export function CommunityProvider({ children }: { children: ReactNode }) {
  useLiving();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null),
  );

  const { data, isLoading } = useQuery({
    queryKey: qk.communities({ limit: 50 }),
    queryFn: () => living.community.list({ limit: 50, sortDir: 'asc', sortBy: 'name' }),
  });

  const communities = useMemo(() => data?.items ?? [], [data]);

  // Default to the persisted community if still present, else the first active one.
  const community = useMemo(() => {
    if (communities.length === 0) return null;
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

  const value = useMemo<CommunityContextValue>(
    () => ({
      communities,
      community,
      communityId: community?.id ?? null,
      setCommunityId,
      isLoading,
    }),
    [communities, community, isLoading],
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity(): CommunityContextValue {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used within a <CommunityProvider>');
  return ctx;
}
