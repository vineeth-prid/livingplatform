import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkOrder, WorkOrderStatus } from '@living/types';

import { living } from '../../lib/living';

const key = (id: string) => ['work-order', id] as const;

export function useWorkOrder(id: string) {
  return useQuery({ queryKey: key(id), queryFn: () => living.workOrder.get(id) });
}

export function useWorkOrderMutations(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key(id) });
    void qc.invalidateQueries({ queryKey: ['work-orders'] });
  };

  const changeStatus = useMutation({
    mutationFn: (input: { status: WorkOrderStatus; note?: string }) =>
      living.workOrder.changeStatus(id, input.status, input.note),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key(id) });
      const previous = qc.getQueryData<WorkOrder>(key(id));
      if (previous) qc.setQueryData<WorkOrder>(key(id), { ...previous, status: input.status });
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(key(id), ctx.previous); },
    onSettled: invalidate,
  });

  const assign = useMutation({
    mutationFn: (input: { staffId?: string; vendorId?: string }) => living.workOrder.assign(id, input),
    onSuccess: invalidate,
  });
  const verify = useMutation({
    mutationFn: (remarks?: string) => living.workOrder.verify(id, remarks),
    onSuccess: invalidate,
  });
  const addUpdate = useMutation({
    mutationFn: (input: { comment: string; progressPercent?: number; isInternal?: boolean }) =>
      living.workOrder.addUpdate(id, input),
    onSuccess: invalidate,
  });
  const addAttachment = useMutation({
    mutationFn: async (file: File) => {
      const signed = await living.workOrder.attachmentUploadUrl(id, {
        fileName: file.name, contentType: file.type || 'application/octet-stream',
      });
      // Storage is a metadata-only stub this phase — register the record; byte
      // PUT wires in when a real provider lands.
      return living.workOrder.addAttachment(id, {
        fileName: file.name, contentType: file.type || 'application/octet-stream',
        size: file.size, storageKey: signed.key,
      });
    },
    onSuccess: invalidate,
  });

  return { changeStatus, assign, verify, addUpdate, addAttachment };
}
