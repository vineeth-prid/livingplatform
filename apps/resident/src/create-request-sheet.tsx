import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';

import { useResidentCommunity } from './community';
import { living } from './lib/living';

const schema = z.object({
  unitId: z.string().min(1, 'Choose your unit'),
  categoryId: z.string().optional(),
  title: z.string().min(3, 'A short title').max(200),
  description: z.string().min(1, 'Tell us a little more').max(4000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});
type FormValues = z.infer<typeof schema>;

/**
 * A bottom-sheet to raise a complaint (ticket) or, when a `serviceId` is given,
 * request a service. Residents pick their unit + category/service (no self-unit
 * endpoint exists yet, so the unit is chosen — this auto-fills once the backend
 * exposes the resident's own record).
 */
export function CreateRequestSheet({
  open, onOpenChange, mode, serviceId, serviceName, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'complaint' | 'service';
  serviceId?: string;
  serviceName?: string;
  onCreated?: () => void;
}) {
  const { communityId } = useResidentCommunity();
  const qc = useQueryClient();

  const units = useQuery({
    queryKey: ['units', communityId, 'pick'],
    queryFn: () => living.community.listUnits(communityId!, { limit: 200, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: open && !!communityId,
  });
  const categories = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: () => living.ticket.listCategories({ activeOnly: true }),
    enabled: open && mode === 'complaint',
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  useEffect(() => { if (open) reset({ unitId: '', categoryId: '', title: '', description: '', priority: 'MEDIUM' }); }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!communityId) return;
    try {
      if (mode === 'complaint') {
        if (!values.categoryId) { toast.error('Please choose a category'); return; }
        await living.ticket.create(communityId, values);
        await qc.invalidateQueries({ queryKey: ['my', 'tickets'] });
        toast.success('Complaint raised');
      } else if (serviceId) {
        await living.serviceRequest.create(communityId, {
          serviceId, unitId: values.unitId, title: values.title,
          description: values.description, priority: values.priority,
        });
        await qc.invalidateQueries({ queryKey: ['my', 'service-requests'] });
        toast.success('Service requested');
      }
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Something went wrong');
    }
  });

  const isService = mode === 'service';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        open={open} side="bottom"
        title={isService ? `Request ${serviceName ?? 'service'}` : 'Raise a complaint'}
        description={isService ? 'We’ll schedule this for you.' : 'Tell us what needs attention.'}
        className="mx-auto max-w-md"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
          <Field label="Your unit" error={errors.unitId?.message}>
            <select {...register('unitId')} className={selectCls}>
              <option value="">{units.isLoading ? 'Loading…' : 'Select unit'}</option>
              {(units.data?.items ?? []).map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
            </select>
          </Field>

          {!isService && (
            <Field label="Category" error={errors.categoryId?.message}>
              <select {...register('categoryId')} className={selectCls}>
                <option value="">{categories.isLoading ? 'Loading…' : 'Select category'}</option>
                {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <Input label="Title" placeholder={isService ? 'e.g. Deep clean' : 'e.g. Leaking tap'} error={errors.title?.message} {...register('title')} />
          <Field label="Details" error={errors.description?.message}>
            <textarea rows={3} placeholder="A little more detail…" className={`${selectCls} py-2`} {...register('description')} />
          </Field>
          <Field label="Priority">
            <select {...register('priority')} className={selectCls}>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option><option value="CRITICAL">Urgent</option>
            </select>
          </Field>

          <Button type="submit" size="lg" block loading={isSubmitting} className="mt-1">
            {isService ? 'Request service' : 'Submit complaint'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const selectCls =
  'h-12 w-full rounded-control border border-border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">{label}</span>
      {children}
      {error && <span className="text-sm text-danger-fg">{error}</span>}
    </label>
  );
}
