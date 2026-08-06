import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Wrench } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Sheet, SheetContent, toast } from '@living/ui';

import { living } from './lib/living';

/**
 * A staff member raising work off the back of a ticket or service request.
 *
 * The branch that matters is COST, not paperwork:
 *
 *  • Money involved → recommended, so it lands in a manager's approval queue.
 *    The originating ticket is parked server-side, because the staff member has
 *    nothing to do until the answer comes back and leaving it "in progress"
 *    tells the resident something untrue.
 *  • No money → nothing to approve. The order is created and the staff member
 *    carries straight on.
 *
 * Staff could never do this at all before: the workforce app had no create
 * screen, so the permission they already held was unreachable.
 */
export function RaiseWorkOrderSheet({
  open,
  onOpenChange,
  communityId,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  origin: { kind: 'ticket' | 'service-request'; id: string; title: string; unitId?: string | null };
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(origin.title);
  const [description, setDescription] = useState('');
  const [labour, setLabour] = useState('');
  const [material, setMaterial] = useState('');

  const labourCost = Number(labour) || 0;
  const materialCost = Number(material) || 0;
  const total = labourCost + materialCost;
  const needsApproval = total > 0;

  const raise = useMutation({
    mutationFn: async () => {
      const input = {
        title: title.trim(),
        description: description.trim() || title.trim(),
        unitId: origin.unitId ?? undefined,
        originType: origin.kind === 'ticket' ? 'TICKET' : 'SERVICE_REQUEST',
        originId: origin.id,
        ...(labourCost > 0 ? { estimatedLabourCost: labourCost } : {}),
        ...(materialCost > 0 ? { estimatedMaterialCost: materialCost } : {}),
      };
      return needsApproval
        ? living.workOrder.recommend(communityId, input)
        : living.workOrder.create(communityId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      void qc.invalidateQueries({ queryKey: ['job'] });
      toast.success(
        needsApproval
          ? 'Sent for approval — the resident has been told work is paused'
          : 'Work order created — carry on',
      );
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(err instanceof LivingApiError ? err.message : 'Could not raise the work order'),
  });

  const canSubmit = title.trim().length >= 3 && !raise.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        open={open}
        side="bottom"
        title="Raise a work order"
        description="Add a cost only if this needs spending approved. Leave it blank to carry on."
      >
        <div className="flex flex-col gap-4">
          <Field label="What needs doing" value={title} onChange={setTitle} />
          <Field
            label="Details"
            value={description}
            onChange={setDescription}
            placeholder="What you found, and what it needs"
            multiline
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Labour cost" value={labour} onChange={setLabour} numeric placeholder="0" />
            <Field label="Material cost" value={material} onChange={setMaterial} numeric placeholder="0" />
          </div>

          {/* The consequence of what they just typed, before they commit to it. */}
          <div
            className={`flex items-start gap-2.5 rounded-card px-3.5 py-3 text-sm ${
              needsApproval
                ? 'bg-[var(--warning-bg)] text-[var(--warning-fg)]'
                : 'bg-sunken text-muted'
            }`}
          >
            {needsApproval ? <IndianRupee className="mt-0.5 h-4 w-4 shrink-0" /> : <Wrench className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {needsApproval ? (
                <>
                  <strong>₹{total.toFixed(2)} needs approval.</strong> This job pauses until a
                  manager decides. You will not be able to work on it in the meantime.
                </>
              ) : (
                <>
                  <strong>No cost — no approval needed.</strong> The work order is created and you
                  can carry straight on.
                </>
              )}
            </span>
          </div>

          <Button size="lg" block loading={raise.isPending} disabled={!canSubmit} onClick={() => raise.mutate()}>
            {needsApproval ? 'Send for approval' : 'Create and continue'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
}) {
  const shared =
    'w-full rounded-control border border-border bg-raised px-3 py-2.5 text-sm text-strong outline-none placeholder:text-subtle focus-visible:shadow-ring';
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">{label}</span>
      {multiline ? (
        <textarea rows={3} className={`${shared} resize-none`} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          className={shared}
          value={value}
          placeholder={placeholder}
          // A numeric keypad on a phone, and no spinner arrows to fat-finger.
          inputMode={numeric ? 'decimal' : undefined}
          onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
        />
      )}
    </label>
  );
}
