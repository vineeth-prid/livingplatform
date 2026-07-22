import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { living } from '../../lib/living';

const key = (id: string) => ['maintenance-plan', id] as const;

export function usePlan(id: string) {
  return useQuery({ queryKey: key(id), queryFn: () => living.maintenance.get(id) });
}

export function usePlanRuns(id: string, enabled = true) {
  return useQuery({ queryKey: ['maintenance-plan', id, 'runs'], queryFn: () => living.maintenance.runs(id), enabled });
}

/** Assets for the plan form + register filters (id + label). */
export function useAssetOptions(communityId: string | null) {
  return useQuery({
    queryKey: ['assets', communityId, 'options'],
    queryFn: () => living.assets.list({ communityId: communityId!, limit: 200, sortBy: 'name', sortDir: 'asc' }),
    enabled: !!communityId,
  });
}

export function useAssetCategoryOptions(communityId: string | null) {
  return useQuery({
    queryKey: ['asset-categories', communityId],
    queryFn: () => living.assetCategories.list({ communityId: communityId!, limit: 200, activeOnly: true, sortBy: 'name', sortDir: 'asc' }),
    enabled: !!communityId,
  });
}

export function usePlanMutations(id?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['maintenance-plans'] });
    if (id) void qc.invalidateQueries({ queryKey: key(id) });
  };

  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => living.maintenance.create(input), onSuccess: invalidate });
  const update = useMutation({ mutationFn: (input: Record<string, unknown>) => living.maintenance.update(id!, input), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: () => living.maintenance.remove(id!), onSuccess: invalidate });
  const pause = useMutation({ mutationFn: () => living.maintenance.pause(id!), onSuccess: invalidate });
  const resume = useMutation({ mutationFn: () => living.maintenance.resume(id!), onSuccess: invalidate });
  const generateNow = useMutation({
    mutationFn: () => living.maintenance.generateNow(id!),
    onSuccess: () => { invalidate(); void qc.invalidateQueries({ queryKey: ['maintenance-plan', id, 'runs'] }); },
  });

  const addChecklistItem = useMutation({
    mutationFn: (input: Record<string, unknown>) => living.maintenance.addChecklistItem(id!, input),
    onSuccess: invalidate,
  });
  const updateChecklistItem = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: Record<string, unknown> }) => living.maintenance.updateChecklistItem(itemId, input),
    onSuccess: invalidate,
  });
  const removeChecklistItem = useMutation({
    mutationFn: (itemId: string) => living.maintenance.removeChecklistItem(itemId),
    onSuccess: invalidate,
  });

  return { create, update, remove, pause, resume, generateNow, addChecklistItem, updateChecklistItem, removeChecklistItem };
}
