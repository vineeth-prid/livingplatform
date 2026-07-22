import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { AMCContract, Asset, MaintenancePlan, WorkOrder } from '@living/types';

import { living } from '../../lib/living';

/**
 * Live PM / AMC / Work-Order relationships for an asset — the data behind the
 * asset-detail relationship tiles (replacing the Sprint-7 placeholders). Work
 * orders are derived from the asset's maintenance-plan runs, since the Work
 * Order API has no asset filter (bounded fan-out, cached).
 */
export function useAssetRelations(asset: Asset) {
  const communityId = asset.communityId;

  const plansQ = useQuery({
    queryKey: ['asset', asset.id, 'plans'],
    queryFn: () => living.maintenance.list({ communityId, assetId: asset.id, limit: 5, sortBy: 'nextRunAt', sortDir: 'asc' }),
  });
  const contractsQ = useQuery({
    queryKey: ['asset', asset.id, 'contracts'],
    queryFn: () => living.amc.list({ communityId, assetId: asset.id, limit: 5, sortBy: 'endDate', sortDir: 'asc' }),
  });

  const planIds = (plansQ.data?.items ?? []).map((p) => p.id);
  const runsResults = useQueries({
    queries: planIds.map((id) => ({ queryKey: ['maintenance-plan', id, 'runs'], queryFn: () => living.maintenance.runs(id), staleTime: 60_000 })),
  });

  const workOrderIds = useMemo(() => {
    const ids = runsResults.flatMap((r) => (r.data ?? []).filter((x) => x.generatedWorkOrderId).map((x) => x.generatedWorkOrderId!));
    return Array.from(new Set(ids)).slice(0, 8);
  }, [runsResults.map((r) => r.dataUpdatedAt).join(',')]);

  const woResults = useQueries({
    queries: workOrderIds.map((id) => ({ queryKey: ['work-order', id], queryFn: () => living.workOrder.get(id), staleTime: 60_000 })),
  });

  return {
    plans: (plansQ.data?.items ?? []) as MaintenancePlan[],
    plansTotal: plansQ.data?.meta.total ?? 0,
    contracts: (contractsQ.data?.items ?? []) as AMCContract[],
    contractsTotal: contractsQ.data?.meta.total ?? 0,
    workOrders: woResults.map((r) => r.data).filter((w): w is WorkOrder => !!w),
    loading: plansQ.isLoading || contractsQ.isLoading,
  };
}
