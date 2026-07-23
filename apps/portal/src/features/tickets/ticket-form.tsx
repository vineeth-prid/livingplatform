import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';
import type { Ticket } from '@living/types';

import { living } from '../../lib/living';
import { EntitySelect, toKey } from '../shared/entity-select';
import { useTicketCategories } from './queries';

const schema = z.object({
  title: z.string().min(3, 'At least 3 characters').max(200),
  description: z.string().min(1, 'Describe the issue').max(4000),
  categoryId: z.string().min(1, 'Choose a category'),
  unitId: z.string().min(1, 'Choose a unit'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  residentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/**
 * Create / edit a ticket in a Sheet (not a full page). React Hook Form + Zod.
 * On edit, unit is fixed (a ticket references exactly one unit); create picks it.
 */
export function TicketForm({
  open, onOpenChange, communityId, ticket, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  ticket?: Ticket;
  onSaved?: (ticket: Ticket) => void;
}) {
  const qc = useQueryClient();
  const editing = !!ticket;
  const categories = useTicketCategories();

  const createCategory = async (name: string) => {
    const created = await living.ticket.createCategory({ key: toKey(name), name });
    await qc.invalidateQueries({ queryKey: ['ticket-categories'] });
    return (created as { id: string }).id;
  };

  const units = useQuery({
    queryKey: [...qk.units(communityId, 'ticket-form')],
    queryFn: () => living.community.listUnits(communityId, { limit: 200, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: open && !editing,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            title: ticket.title, description: ticket.description, categoryId: ticket.categoryId,
            unitId: ticket.unitId, priority: ticket.priority, residentId: ticket.residentId ?? undefined,
          }
        : { title: '', description: '', categoryId: '', unitId: '', priority: 'MEDIUM' },
    );
  }, [open, editing, ticket, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = editing
        ? await living.ticket.update(ticket.id, {
            title: values.title, description: values.description,
            categoryId: values.categoryId, priority: values.priority, residentId: values.residentId,
          })
        : await living.ticket.create(communityId, values);
      await qc.invalidateQueries({ queryKey: ['tickets'] });
      if (editing) await qc.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      toast.success(editing ? 'Ticket updated' : 'Ticket raised');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not save the ticket');
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        open={open} side="right"
        title={editing ? 'Edit ticket' : 'Raise a ticket'}
        description={editing ? undefined : 'Log an operational issue against a unit.'}
        className="w-[min(94vw,540px)]"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Title" placeholder="Kitchen tap is leaking" error={errors.title?.message} {...register('title')} />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Description</span>
            <textarea
              rows={4}
              placeholder="What’s happening?"
              className="rounded-control border border-border bg-raised px-3 py-2 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
              {...register('description')}
            />
            {errors.description && <span className="text-sm text-danger-fg">{errors.description.message}</span>}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EntitySelect label="Category" required error={errors.categoryId?.message}
              value={watch('categoryId') ?? ''} onChange={(v) => setValue('categoryId', v, { shouldValidate: true })}
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              loading={categories.isLoading} placeholder="Choose a category" onCreate={createCategory} />
            <Select label="Priority" {...register('priority')}
              options={[
                { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' },
              ]} />
          </div>

          {!editing && (
            <Select label="Unit" error={errors.unitId?.message} {...register('unitId')}
              options={(units.data?.items ?? []).map((u) => ({ value: u.id, label: u.unitNumber }))}
              placeholder={units.isLoading ? 'Loading units…' : 'Choose a unit'} />
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editing ? 'Save changes' : 'Raise ticket'}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Small native select wired for RHF's register() spread. */
const Select = ({
  label, error, options, placeholder, ...rest
}: {
  label: string; error?: string; options: { value: string; label: string }[]; placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-strong">{label}</span>
    <select
      className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <span className="text-sm text-danger-fg">{error}</span>}
  </label>
);
