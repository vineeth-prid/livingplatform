import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceRequest, ServiceRequestStatus } from '@living/types';

import { living } from '../../lib/living';

const key = (id: string) => ['service-request', id] as const;

export function useServiceRequest(id: string) {
  return useQuery({ queryKey: key(id), queryFn: () => living.serviceRequest.get(id) });
}

export function useServices() {
  return useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => living.serviceRequest.listServices({ activeOnly: true }),
    staleTime: 5 * 60_000,
  });
}

export function useServiceRequestFeedback(id: string, enabled: boolean) {
  return useQuery({ queryKey: [...key(id), 'feedback'], queryFn: () => living.serviceRequest.getFeedback(id), enabled });
}

/** SR mutations with optimistic status change (rollback on error). */
export function useServiceRequestMutations(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key(id) });
    void qc.invalidateQueries({ queryKey: ['service-requests'] });
  };

  const changeStatus = useMutation({
    mutationFn: (input: { status: ServiceRequestStatus; note?: string }) =>
      living.serviceRequest.changeStatus(id, input.status, input.note),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key(id) });
      const previous = qc.getQueryData<ServiceRequest>(key(id));
      if (previous) qc.setQueryData<ServiceRequest>(key(id), { ...previous, status: input.status });
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(key(id), ctx.previous); },
    onSettled: invalidate,
  });

  const assign = useMutation({
    mutationFn: (input: { staffId?: string; vendorId?: string }) => living.serviceRequest.assign(id, input),
    onSuccess: invalidate,
  });
  const schedule = useMutation({
    mutationFn: (input: Record<string, unknown>) => living.serviceRequest.schedule(id, input),
    onSuccess: invalidate,
  });
  const submitFeedback = useMutation({
    mutationFn: (input: { rating: number; comment?: string }) => living.serviceRequest.submitFeedback(id, input),
    onSuccess: invalidate,
  });

  return { changeStatus, assign, schedule, submitFeedback };
}
