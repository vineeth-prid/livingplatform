import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';
import type { Community } from '@living/types';

import { living } from './lib/living';

interface CommunityValue {
  community: Community | null;
  communityId: string | null;
  isLoading: boolean;
}

const Ctx = createContext<CommunityValue | null>(null);

/** Resolves the resident's community (first active in their tenant). No
 *  "my community" endpoint exists, so we use the tenant's community list —
 *  a resident's tenant is their community. */
export function CommunityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: () => living.community.list({ limit: 20, sortDir: 'asc', sortBy: 'name' }),
    enabled: isAuthenticated,
  });

  const community = useMemo(() => {
    const items = data?.items ?? [];
    return items.find((c) => c.status === 'ACTIVE') ?? items[0] ?? null;
  }, [data]);

  const value = useMemo<CommunityValue>(
    () => ({ community, communityId: community?.id ?? null, isLoading }),
    [community, isLoading],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useResidentCommunity(): CommunityValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useResidentCommunity must be used within CommunityProvider');
  return ctx;
}
