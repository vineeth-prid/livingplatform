import { useQuery } from '@tanstack/react-query';
import type { CommunityFeatures } from '@living/living-sdk';

import { useLiving } from './sdk-context';

/** Every optional module is ON until the API says otherwise. */
const DEFAULTS: CommunityFeatures = {
  maintenanceBilling: true,
  servicePackages: true,
  gateManagement: true,
  gateApproval: true,
  gateSound: true,
};

export interface CommunityFeatureState extends CommunityFeatures {
  isLoading: boolean;
}

/**
 * Which optional modules a community runs.
 *
 * Every app gates its maintenance and packages UI on this, so a surface is
 * never rendered whose API would 404. Shared here rather than duplicated in
 * portal and resident because the two must agree — a toggle honoured in one app
 * and ignored in the other is worse than no toggle.
 *
 * Defaults to ON while loading: showing a module for a moment and then hiding
 * it is a far smaller sin than hiding a community's billing every time the
 * network is slow.
 */
export function useCommunityFeatures(communityId: string | null | undefined): CommunityFeatureState {
  const living = useLiving();
  const { data, isLoading } = useQuery({
    queryKey: ['community', communityId, 'features'],
    queryFn: () => living.community.features(communityId!),
    enabled: !!communityId,
    // Toggles change rarely; don't re-ask on every screen mount.
    staleTime: 5 * 60_000,
  });

  return { ...DEFAULTS, ...(data ?? {}), isLoading: isLoading && !!communityId };
}
