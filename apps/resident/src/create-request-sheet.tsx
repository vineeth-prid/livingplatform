import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import type { Service } from '@living/types';
import { cn } from '@living/utils';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';

import { useResidentCommunity } from './community';
import { useMyResident } from './community-ops';
import { living } from './lib/living';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

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
 * request a service.
 *
 * The unit list is the resident's OWN unit(s), not the community's — a resident
 * raising a complaint against a neighbour's flat is never the intent. With a
 * single unit (the normal case) it is preselected and the field is read-only.
 */
export function CreateRequestSheet({
  open, onOpenChange, mode, serviceId, serviceName, service, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'complaint' | 'service';
  serviceId?: string;
  serviceName?: string;
  /** The full catalogue row, when the caller has it — carries priced options. */
  service?: Service;
  onCreated?: () => void;
}) {
  const { communityId } = useResidentCommunity();
  const qc = useQueryClient();

  const { units, isLoading: unitsLoading } = useMyResident();
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Options come from the service the caller already has in hand — the catalog
  // list carries them, so there is nothing extra to fetch.
  const variants = useMemo(
    () => (service?.variants ?? []).filter((v) => v.isActive),
    [service],
  );

  // Preselect when there is only one option — a single-choice picker is a
  // pointless tap.
  useEffect(() => {
    if (variants.length === 1) setVariantId(variants[0]!.id);
  }, [variants.length, variants]);

  const unitPrice = variantId
    ? Number(variants.find((v) => v.id === variantId)?.price ?? NaN)
    : Number(service?.basePrice ?? NaN);
  const lineTotal = Number.isFinite(unitPrice) ? unitPrice * quantity : null;

  const categories = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: () => living.ticket.listCategories({ activeOnly: true }),
    enabled: open && mode === 'complaint',
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  // Preselect the only unit they have, so the common case is one less tap.
  const onlyUnitId = units.length === 1 ? units[0]!.id : '';
  useEffect(() => {
    if (open) {
      reset({ unitId: onlyUnitId, categoryId: '', title: '', description: '', priority: 'MEDIUM' });
      setVariantId('');
      setQuantity(1);
    }
  }, [open, reset, onlyUnitId]);

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
          variantId: variantId || undefined,
          quantity,
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
          <Field
            label="Your unit"
            error={
              errors.unitId?.message ??
              (!unitsLoading && units.length === 0
                ? 'Your account is not linked to a unit yet — ask management to link it.'
                : undefined)
            }
          >
            <select {...register('unitId')} className={selectCls} disabled={units.length <= 1}>
              {units.length !== 1 && (
                <option value="">{unitsLoading ? 'Loading…' : 'Select unit'}</option>
              )}
              {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
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
          {/* Options and quantity only exist for a service request. A service
              that offers options REQUIRES one — the API refuses to guess,
              because guessing quotes a hatchback price for an SUV. */}
          {isService && variants.length > 0 && (
            <Field label="Option" error={!variantId ? 'Choose an option' : undefined}>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      'rounded-pill px-3 py-1.5 text-sm',
                      variantId === v.id ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted',
                    )}
                  >
                    {v.name}
                    {v.price != null && ` · ${inr(Number(v.price))}`}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {isService && (
            <Field label="How many?">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-control bg-sunken text-strong disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center text-base font-semibold text-strong" data-numeric>
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="More"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-control bg-sunken text-strong disabled:opacity-40"
                  disabled={quantity >= 20}
                >
                  <Plus className="h-4 w-4" />
                </button>
                {lineTotal != null && (
                  <span className="ml-auto text-sm text-muted">
                    Total <span className="font-medium text-strong">{inr(lineTotal)}</span>
                  </span>
                )}
              </div>
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
