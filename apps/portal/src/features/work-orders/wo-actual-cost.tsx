import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, toast } from '@living/ui';
import type { WorkOrder } from '@living/types';

import { formatMoney } from '../amc/config';
import { Field, FieldGrid } from '../master-data';
import { useWorkOrderMutations } from './queries';
import { parseCost } from './wo-verification';

const DONE = ['COMPLETED', 'VERIFIED', 'CLOSED'];

/**
 * What the work actually cost. Once verified, it is the work order's line in
 * the community's expenses; correcting it here updates that line, and clearing
 * it reverses it (the record is kept, not deleted). Managers only.
 */
export function WorkOrderActualCost({ workOrder }: { workOrder: WorkOrder }) {
  const { hasPermission } = useAuth();
  const { setActualCost } = useWorkOrderMutations(workOrder.id);
  const [editing, setEditing] = useState(false);
  const [labour, setLabour] = useState(workOrder.actualLabourCost ?? '');
  const [material, setMaterial] = useState(workOrder.actualMaterialCost ?? '');
  const canEdit = hasPermission('workorder:verify') && DONE.includes(workOrder.status);
  const counted = (workOrder.status === 'VERIFIED' || workOrder.status === 'CLOSED') && Number(workOrder.actualTotalCost ?? 0) > 0;

  const labourCost = parseCost(String(labour));
  const materialCost = parseCost(String(material));
  const invalid = Number.isNaN(labourCost) || Number.isNaN(materialCost);

  async function save() {
    try {
      await setActualCost.mutateAsync({ actualLabourCost: labourCost ?? null, actualMaterialCost: materialCost ?? null });
      toast.success('Actual cost saved');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not save the cost');
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Labour (₹)" type="number" inputMode="decimal" min="0" step="0.01" value={labour} onChange={(e) => setLabour(e.target.value)} />
          <Input label="Material (₹)" type="number" inputMode="decimal" min="0" step="0.01" value={material} onChange={(e) => setMaterial(e.target.value)} />
        </div>
        <p className="text-xs text-subtle">
          {invalid ? 'Enter amounts in rupees with up to 2 decimals.' : 'Clear both to withdraw the cost — its expense is reversed, and the history is kept.'}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} loading={setActualCost.isPending} disabled={invalid}>Save cost</Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FieldGrid cols={2}>
        <Field label="Labour" value={workOrder.actualLabourCost != null ? formatMoney(workOrder.actualLabourCost) : null} />
        <Field label="Material" value={workOrder.actualMaterialCost != null ? formatMoney(workOrder.actualMaterialCost) : null} />
        <Field label="Total" value={workOrder.actualTotalCost != null ? formatMoney(workOrder.actualTotalCost) : null} />
      </FieldGrid>
      <p className="text-xs text-subtle">
        {counted ? (
          <>
            Recorded in the community&apos;s{' '}
            <Link to={'/expenses' as string} className="text-brand hover:underline">expenses</Link>.
          </>
        ) : DONE.includes(workOrder.status) ? (
          'Becomes a community expense once the work order is verified.'
        ) : (
          'Recorded once the work is completed.'
        )}
      </p>
      {canEdit && (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setEditing(true)}>
          {workOrder.actualTotalCost != null ? 'Correct actual cost' : 'Record actual cost'}
        </Button>
      )}
    </div>
  );
}
