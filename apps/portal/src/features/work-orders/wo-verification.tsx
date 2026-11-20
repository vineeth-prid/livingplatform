import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Button, Input, toast } from '@living/ui';
import type { WorkOrder } from '@living/types';

import { Field, FieldGrid } from '../master-data';
import { useWorkOrderMutations } from './queries';

/** Parse a rupee input: blank → undefined, otherwise a number ≥ 0 with ≤ 2 decimals (NaN when invalid). */
export function parseCost(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : Number.NaN;
}

/**
 * Verification — only Facility Managers / Association Admins hold
 * `workorder:verify`. A completed work order can be verified (with remarks),
 * which is the gate before it may be closed (verify-before-close).
 *
 * The actual cost is confirmed here too: what the community really paid becomes
 * a community expense once the work is verified. Estimates are never counted.
 */
export function WorkOrderVerification({ workOrder }: { workOrder: WorkOrder }) {
  const { hasPermission } = useAuth();
  const { verify } = useWorkOrderMutations(workOrder.id);
  const [remarks, setRemarks] = useState('');
  const [labour, setLabour] = useState('');
  const [material, setMaterial] = useState('');
  const canVerify = hasPermission('workorder:verify');
  const alreadyVerified = !!workOrder.verifiedDate;
  const canVerifyNow = workOrder.status === 'COMPLETED' && canVerify;

  const labourCost = parseCost(labour);
  const materialCost = parseCost(material);
  const costError = Number.isNaN(labourCost) || Number.isNaN(materialCost);

  async function onVerify() {
    try {
      await verify.mutateAsync({ remarks: remarks || undefined, actualLabourCost: labourCost, actualMaterialCost: materialCost });
      toast.success(
        (labourCost ?? 0) + (materialCost ?? 0) > 0
          ? 'Work order verified — its actual cost is recorded under Expenses'
          : 'Work order verified',
      );
      setRemarks('');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not verify');
    }
  }

  if (alreadyVerified) {
    return (
      <FieldGrid cols={2}>
        <Field label="Verified on" value={workOrder.verifiedDate ? formatDateTime(workOrder.verifiedDate) : null} />
        <Field label="Remarks" value={workOrder.verificationRemarks} />
      </FieldGrid>
    );
  }

  if (!canVerifyNow) {
    return (
      <p className="text-sm text-subtle">
        {workOrder.status === 'COMPLETED'
          ? 'Awaiting verification by a manager.'
          : 'Verification opens once the work is completed.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Verification remarks (optional)"
        rows={2}
        className="rounded-control border border-border bg-raised px-3 py-2 text-sm text-strong outline-none transition-shadow focus-visible:shadow-ring"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Actual labour cost (₹)" type="number" inputMode="decimal" min="0" step="0.01" value={labour}
          onChange={(e) => setLabour(e.target.value)}
          placeholder={workOrder.estimatedLabourCost ? `Estimate ${workOrder.estimatedLabourCost}` : 'Optional'} />
        <Input label="Actual material cost (₹)" type="number" inputMode="decimal" min="0" step="0.01" value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder={workOrder.estimatedMaterialCost ? `Estimate ${workOrder.estimatedMaterialCost}` : 'Optional'} />
      </div>
      <p className="text-xs text-subtle">
        {costError
          ? 'Enter amounts in rupees with up to 2 decimals.'
          : 'What the community actually paid. It is recorded under Expenses when you verify. Leave blank if there was no cost, or add it later.'}
      </p>
      <Button size="sm" className="self-start" loading={verify.isPending} onClick={onVerify} disabled={costError}>
        <ShieldCheck className="h-4 w-4" /> Verify work order
      </Button>
    </div>
  );
}
