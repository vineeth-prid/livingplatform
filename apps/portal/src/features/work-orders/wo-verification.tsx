import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Button, toast } from '@living/ui';
import type { WorkOrder } from '@living/types';

import { Field, FieldGrid } from '../master-data';
import { useWorkOrderMutations } from './queries';

/**
 * Verification — only Facility Managers / Association Admins hold
 * `workorder:verify`. A completed work order can be verified (with remarks),
 * which is the gate before it may be closed (verify-before-close).
 */
export function WorkOrderVerification({ workOrder }: { workOrder: WorkOrder }) {
  const { hasPermission } = useAuth();
  const { verify } = useWorkOrderMutations(workOrder.id);
  const [remarks, setRemarks] = useState('');
  const canVerify = hasPermission('workorder:verify');
  const alreadyVerified = !!workOrder.verifiedDate;
  const canVerifyNow = workOrder.status === 'COMPLETED' && canVerify;

  async function onVerify() {
    try {
      await verify.mutateAsync(remarks || undefined);
      toast.success('Work order verified');
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
      <Button size="sm" className="self-start" loading={verify.isPending} onClick={onVerify}>
        <ShieldCheck className="h-4 w-4" /> Verify work order
      </Button>
    </div>
  );
}
