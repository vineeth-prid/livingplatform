import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';
import type { WorkOrder } from '@living/types';

import { living } from '../../lib/living';
import { OpsSelect } from '../operations/ops-select';

const schema = z.object({
  title: z.string().min(3, 'At least 3 characters').max(200),
  description: z.string().min(1, 'Describe the work').max(4000),
  unitId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  estimatedHours: z.string().optional(),
  estimatedLabourCost: z.string().optional(),
  estimatedMaterialCost: z.string().optional(),
  requestApproval: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

const num = (v?: string) => (v ? Number(v) : undefined);

/** Create / edit a work order (RHF + Zod). Unit is optional — some work is
 *  community/common-area wide. */
export function WorkOrderForm({
  open, onOpenChange, communityId, workOrder, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  workOrder?: WorkOrder;
  onSaved?: (w: WorkOrder) => void;
}) {
  const qc = useQueryClient();
  const editing = !!workOrder;
  const units = useQuery({
    queryKey: [...qk.units(communityId, 'wo-form')],
    queryFn: () => living.community.listUnits(communityId, { limit: 200, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: open,
  });

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  useEffect(() => {
    if (!open) return;
    reset(editing
      ? { title: workOrder.title, description: workOrder.description, unitId: workOrder.unitId ?? '',
          priority: workOrder.priority,
          estimatedHours: workOrder.estimatedHours != null ? String(workOrder.estimatedHours) : '',
          estimatedLabourCost: workOrder.estimatedLabourCost ?? '',
          estimatedMaterialCost: workOrder.estimatedMaterialCost ?? '',
          requestApproval: false }
      : { title: '', description: '', unitId: '', priority: 'MEDIUM', estimatedHours: '',
          estimatedLabourCost: '', estimatedMaterialCost: '', requestApproval: false });
  }, [open, editing, workOrder, reset]);

  const labour = num(watch('estimatedLabourCost'));
  const material = num(watch('estimatedMaterialCost'));
  const total = labour != null || material != null ? (labour ?? 0) + (material ?? 0) : undefined;
  const requestApproval = watch('requestApproval');

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      title: values.title, description: values.description, priority: values.priority,
      unitId: values.unitId || undefined,
      estimatedHours: num(values.estimatedHours),
      estimatedLabourCost: num(values.estimatedLabourCost),
      estimatedMaterialCost: num(values.estimatedMaterialCost),
    };
    try {
      const saved = editing
        ? await living.workOrder.update(workOrder.id, payload)
        : values.requestApproval
          ? await living.workOrder.recommend(communityId, payload)
          : await living.workOrder.create(communityId, payload);
      await qc.invalidateQueries({ queryKey: ['work-orders'] });
      if (editing) await qc.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      toast.success(editing ? 'Work order updated'
        : values.requestApproval ? 'Recommended for approval' : 'Emergency work order created');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not save');
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right"
        title={editing ? 'Edit work order' : 'Manual work order'}
        description={editing ? undefined : 'For emergency situations (fire system failure, burst pipe, generator breakdown…).'}
        className="w-[min(94vw,540px)]">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {!editing && (
            <p className="rounded-control border border-border bg-muted px-3 py-2 text-xs text-subtle">
              Most work orders are generated after operational approval. Manual work orders are intended for emergency situations.
            </p>
          )}
          <Input label="Title" placeholder="Replace corridor light fittings" error={errors.title?.message} {...register('title')} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Description</span>
            <textarea rows={4} placeholder="What work is to be done?"
              className="rounded-control border border-border bg-raised px-3 py-2 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
              {...register('description')} />
            {errors.description && <span className="text-sm text-danger-fg">{errors.description.message}</span>}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsSelect label="Unit (optional)" {...register('unitId')}
              placeholder={units.isLoading ? 'Loading…' : 'Common area / none'}
              options={(units.data?.items ?? []).map((u) => ({ value: u.id, label: u.unitNumber }))} />
            <OpsSelect label="Priority" {...register('priority')}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }]} />
          </div>
          <Input label="Estimated hours" type="number" step="0.5" placeholder="2.5" {...register('estimatedHours')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Estimated labour cost" type="number" step="0.01" placeholder="4000" {...register('estimatedLabourCost')} />
            <Input label="Estimated material cost" type="number" step="0.01" placeholder="12000" {...register('estimatedMaterialCost')} />
          </div>
          {total != null && (
            <p className="text-sm text-subtle">Estimated total: <span className="font-medium text-strong">{total.toLocaleString()}</span></p>
          )}
          {!editing && (
            <label className="flex items-start gap-2 text-sm text-body">
              <input type="checkbox" className="mt-1" {...register('requestApproval')} />
              <span>Request approval instead — recommend this work order for a manager to approve (non-emergency).</span>
            </label>
          )}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save changes' : requestApproval ? 'Recommend' : 'Create emergency WO'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
