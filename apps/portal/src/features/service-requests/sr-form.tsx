import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';
import type { ServiceRequest } from '@living/types';

import { living } from '../../lib/living';
import { OpsSelect } from '../operations/ops-select';
import { useServices } from './queries';

const schema = z.object({
  title: z.string().min(3, 'At least 3 characters').max(200),
  description: z.string().min(1, 'Describe the work').max(4000),
  serviceId: z.string().min(1, 'Choose a service'),
  unitId: z.string().min(1, 'Choose a unit'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  preferredTimeSlot: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/** Create / edit a service request (RHF + Zod), in a Sheet. */
export function ServiceRequestForm({
  open, onOpenChange, communityId, request, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  request?: ServiceRequest;
  onSaved?: (r: ServiceRequest) => void;
}) {
  const qc = useQueryClient();
  const editing = !!request;
  const services = useServices();
  const units = useQuery({
    queryKey: [...qk.units(communityId, 'sr-form')],
    queryFn: () => living.community.listUnits(communityId, { limit: 200, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: open && !editing,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  useEffect(() => {
    if (!open) return;
    reset(editing
      ? { title: request.title, description: request.description, serviceId: request.serviceId,
          unitId: request.unitId, priority: request.priority, preferredTimeSlot: request.preferredTimeSlot ?? '' }
      : { title: '', description: '', serviceId: '', unitId: '', priority: 'MEDIUM', preferredTimeSlot: '' });
  }, [open, editing, request, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = editing
        ? await living.serviceRequest.update(request.id, {
            title: values.title, description: values.description, serviceId: values.serviceId, priority: values.priority })
        : await living.serviceRequest.create(communityId, values);
      await qc.invalidateQueries({ queryKey: ['service-requests'] });
      if (editing) await qc.invalidateQueries({ queryKey: ['service-request', request.id] });
      toast.success(editing ? 'Request updated' : 'Request raised');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not save');
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right"
        title={editing ? 'Edit request' : 'New service request'}
        description={editing ? undefined : 'Request planned work for a unit.'}
        className="w-[min(94vw,540px)]">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Title" placeholder="Deep clean the apartment" error={errors.title?.message} {...register('title')} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Description</span>
            <textarea rows={4} placeholder="What needs doing?"
              className="rounded-control border border-border bg-raised px-3 py-2 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
              {...register('description')} />
            {errors.description && <span className="text-sm text-danger-fg">{errors.description.message}</span>}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsSelect label="Service" error={errors.serviceId?.message} {...register('serviceId')}
              placeholder={services.isLoading ? 'Loading…' : 'Choose a service'}
              options={(services.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <OpsSelect label="Priority" {...register('priority')}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }]} />
          </div>
          {!editing && (
            <OpsSelect label="Unit" error={errors.unitId?.message} {...register('unitId')}
              placeholder={units.isLoading ? 'Loading units…' : 'Choose a unit'}
              options={(units.data?.items ?? []).map((u) => ({ value: u.id, label: u.unitNumber }))} />
          )}
          <Input label="Preferred time slot" placeholder="Morning (9–12)" {...register('preferredTimeSlot')} />
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editing ? 'Save changes' : 'Raise request'}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
