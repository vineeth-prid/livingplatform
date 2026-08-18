import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { living } from '../../lib/living';

/**
 * Visitors are VISITOR gate entries.
 *
 * They used to live in their own `visitors` table with its own statuses and
 * lifecycle, which the security console never read — so an invitation approved
 * here changed nothing at the gate. Everything below now speaks to the gate
 * engine, and the badges/status list come from `gate-lib` so the portal, the
 * guard's console and the resident app describe the same record identically.
 */
export { GATE_STATUS as VISITOR_STATUS, GateStatusBadge as VisitorStatusBadge, humanize } from '../gate/gate-lib';

export function useVisitor(id: string) {
  return useQuery({ queryKey: ['gate-entry', id], queryFn: () => living.gate.get(id) });
}

/** Units for the invite form. A visit is always to a flat. */
export function useUnitOptions(communityId: string | null) {
  return useQuery({
    queryKey: ['units', communityId, 'options'],
    queryFn: () => living.community.listUnits(communityId!, { limit: 500, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: !!communityId,
  });
}

/** Resident options for the resident filter. */
export function useResidentOptions(communityId: string | null) {
  return useQuery({
    queryKey: ['residents', communityId, 'options'],
    queryFn: () => living.people.listResidents(communityId!, { limit: 200, sortBy: 'firstName', sortDir: 'asc' }),
    enabled: !!communityId,
  });
}

export function useVisitorMutations(id?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['gate-entries'] });
    void qc.invalidateQueries({ queryKey: ['visitors'] });
    if (id) void qc.invalidateQueries({ queryKey: ['gate-entry', id] });
  };

  return {
    /** Admin invites on a resident's behalf — an ordinary VISITOR gate entry. */
    create: useMutation({
      mutationFn: ({ communityId, ...input }: Record<string, unknown> & { communityId: string }) =>
        living.gate.create(communityId, { entryType: 'VISITOR', ...input } as never),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: Record<string, unknown>) => living.gate.update(id!, input as never),
      onSuccess: invalidate,
    }),
    approve: useMutation({ mutationFn: (note?: string) => living.gate.approve(id!, note), onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (note?: string) => living.gate.reject(id!, note), onSuccess: invalidate }),
    /** The visitor has come and gone. Replaces the old check-in/check-out pair. */
    complete: useMutation({ mutationFn: () => living.gate.complete(id!), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (note?: string) => living.gate.cancel(id!, note), onSuccess: invalidate }),
  };
}
