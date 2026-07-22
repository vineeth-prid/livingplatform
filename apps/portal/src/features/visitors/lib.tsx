import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, type BadgeProps } from '@living/ui';

import { living } from '../../lib/living';

type Tone = NonNullable<BadgeProps['tone']>;

export const VISITOR_STATUS = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'REJECTED'] as const;
export const VISITOR_TYPE = ['GUEST', 'DELIVERY', 'SERVICE', 'CAB', 'OTHER'] as const;

const STATUS_TONE: Record<string, Tone> = {
  PENDING: 'info', APPROVED: 'brand', CHECKED_IN: 'warning', CHECKED_OUT: 'success', REJECTED: 'danger',
};
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function VisitorStatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}
export function VisitorTypeBadge({ type, size = 'sm' }: { type: string; size?: BadgeProps['size'] }) {
  return <Badge tone="neutral" size={size}>{humanize(type)}</Badge>;
}

export function useVisitor(id: string) {
  return useQuery({ queryKey: ['visitor', id], queryFn: () => living.visitors.get(id) });
}

/** Resident options for the resident filter + create form. */
export function useResidentOptions(communityId: string | null) {
  return useQuery({
    queryKey: ['residents', communityId, 'options'],
    queryFn: () => living.people.listResidents(communityId!, { limit: 200, sortBy: 'firstName', sortDir: 'asc' }),
    enabled: !!communityId,
  });
}

export function useVisitorMutations(id?: string) {
  const qc = useQueryClient();
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['visitors'] }); if (id) void qc.invalidateQueries({ queryKey: ['visitor', id] }); };
  const act = (fn: () => Promise<unknown>) => ({ mutationFn: fn, onSuccess: invalidate });

  return {
    create: useMutation({ mutationFn: (input: Record<string, unknown>) => living.visitors.create(input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: Record<string, unknown>) => living.visitors.update(id!, input), onSuccess: invalidate }),
    approve: useMutation(act(() => living.visitors.approve(id!))),
    reject: useMutation({ mutationFn: (reason?: string) => living.visitors.reject(id!, reason), onSuccess: invalidate }),
    checkIn: useMutation(act(() => living.visitors.checkIn(id!))),
    checkOut: useMutation(act(() => living.visitors.checkOut(id!))),
    cancel: useMutation(act(() => living.visitors.cancel(id!))),
  };
}
