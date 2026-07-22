import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { living } from '../../lib/living';

const key = (id: string) => ['amc-contract', id] as const;

export function useContract(id: string) {
  return useQuery({ queryKey: key(id), queryFn: () => living.amc.get(id) });
}

export function useCoverages(id: string, enabled = true) {
  return useQuery({ queryKey: ['amc-contract', id, 'coverages'], queryFn: () => living.amc.coverages(id), enabled });
}

export function useContractHistory(id: string, enabled = true) {
  return useQuery({ queryKey: ['amc-contract', id, 'history'], queryFn: () => living.amc.history(id), enabled });
}

/** Vendors for the contract form + register filter. */
export function useVendorOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => living.people.listVendors({ limit: 200, sortBy: 'name', sortDir: 'asc' }),
    enabled,
  });
}

export function useContractMutations(id?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['amc-contracts'] });
    if (id) void qc.invalidateQueries({ queryKey: key(id) });
  };
  const invalidateCoverage = () => { invalidate(); if (id) void qc.invalidateQueries({ queryKey: ['amc-contract', id, 'coverages'] }); };
  const invalidateHistory = () => { if (id) void qc.invalidateQueries({ queryKey: ['amc-contract', id, 'history'] }); };

  const create = useMutation({ mutationFn: (input: Record<string, unknown>) => living.amc.create(input), onSuccess: invalidate });
  const update = useMutation({ mutationFn: (input: Record<string, unknown>) => living.amc.update(id!, input), onSuccess: () => { invalidate(); invalidateHistory(); } });
  const remove = useMutation({ mutationFn: () => living.amc.remove(id!), onSuccess: invalidate });
  const renew = useMutation({ mutationFn: (input: Record<string, unknown>) => living.amc.renew(id!, input as never), onSuccess: () => { invalidate(); invalidateHistory(); } });

  const addCoverage = useMutation({ mutationFn: (input: Record<string, unknown>) => living.amc.addCoverage(id!, input), onSuccess: () => { invalidateCoverage(); invalidateHistory(); } });
  const removeCoverage = useMutation({ mutationFn: (assetId: string) => living.amc.removeCoverage(id!, assetId), onSuccess: () => { invalidateCoverage(); invalidateHistory(); } });

  const addSla = useMutation({ mutationFn: (input: Record<string, unknown>) => living.amc.addSla(id!, input), onSuccess: () => { invalidate(); invalidateHistory(); } });
  const updateSla = useMutation({ mutationFn: ({ slaId, input }: { slaId: string; input: Record<string, unknown> }) => living.amc.updateSla(slaId, input), onSuccess: invalidate });
  const removeSla = useMutation({ mutationFn: (slaId: string) => living.amc.removeSla(slaId), onSuccess: invalidate });

  return { create, update, remove, renew, addCoverage, removeCoverage, addSla, updateSla, removeSla };
}
