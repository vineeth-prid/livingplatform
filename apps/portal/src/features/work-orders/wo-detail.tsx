import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Archive, Check, Pencil, X } from 'lucide-react';
import { formatDate } from '@living/utils';
import { Badge, Button, toast, useConfirm } from '@living/ui';
import type { WorkOrderStatus } from '@living/types';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { formatMoney } from '../amc/config';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid,
} from '../master-data';
import { OperationsAssignment, OperationsStatusMenu, OperationsTimeline, PriorityPill, StatusPill } from '../operations';
import { WO_ORIGIN_LABEL, WO_ORIGIN_TONES, WO_TONES, woWorkflow } from './config';
import { WorkOrderAttachments } from './wo-attachments';
import { WorkOrderProgress } from './wo-progress';
import { WorkOrderVerification } from './wo-verification';
import { WorkOrderForm } from './wo-form';
import { useWorkOrder, useWorkOrderMutations } from './queries';

export function WorkOrderDetailPage() {
  const { workOrderId } = useParams({ strict: false }) as { workOrderId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');

  const q = useWorkOrder(workOrderId);
  const w = q.data;
  const { changeStatus, assign, approve, reject } = useWorkOrderMutations(workOrderId);
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  const timeline = useQuery({
    queryKey: ['work-order', workOrderId, 'timeline'],
    queryFn: () => living.workOrder.timeline(workOrderId),
    enabled: !!w,
  });

  async function onStatus(to: WorkOrderStatus) {
    try { await changeStatus.mutateAsync({ status: to }); toast.success('Status updated'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not update'); }
  }
  async function onAssign(input: { staffId?: string; vendorId?: string }) {
    try { await assign.mutateAsync(input); toast.success('Assigned'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not assign'); }
  }
  async function onApprove() {
    try { await approve.mutateAsync(reason.trim() || undefined); setReason(''); toast.success('Work order approved'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not approve'); }
  }
  async function onReject() {
    if (reason.trim().length < 3) { toast.error('A rejection reason is required'); return; }
    try { await reject.mutateAsync(reason.trim()); setReason(''); toast.success('Work order rejected'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not reject'); }
  }
  async function onDelete() {
    if (!w) return;
    if (!(await confirm({ title: `Delete ${w.workOrderNumber}?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try { await living.workOrder.remove(w.id); toast.success('Work order deleted'); navigate({ to: '/work-orders' as string }); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not delete'); }
  }

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/work-orders">
      {w && (
        <>
          <DetailHeader
            showAvatar={false}
            title={w.title}
            subtitle={<span className="font-mono text-sm">{w.workOrderNumber}</span>}
            status={<StatusPill status={w.status} tones={WO_TONES} size="md" />}
            meta={<>
              <Badge tone={WO_ORIGIN_TONES[w.originType] ?? 'neutral'} size="sm">{WO_ORIGIN_LABEL[w.originType] ?? w.originType}</Badge>
              <PriorityPill priority={w.priority} />
              <span>Created {formatDate(w.createdAt)}</span>
            </>}
            actions={
              <>
                <OperationsStatusMenu status={w.status} workflow={woWorkflow} onChange={onStatus} pending={changeStatus.isPending} />
                {hasPermission('workorder:update') && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
                {hasPermission('workorder:close') && <Button variant="ghost" onClick={onDelete} aria-label="Delete"><Archive className="h-4 w-4" /></Button>}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Execution-first main column */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Description"><p className="whitespace-pre-wrap text-sm text-body">{w.description}</p></DetailSection>
              <DetailSection title="Progress"><WorkOrderProgress workOrderId={w.id} /></DetailSection>
              <DetailSection title="Attachments"><WorkOrderAttachments workOrderId={w.id} /></DetailSection>
            </div>

            {/* Context sidebar */}
            <div className="flex flex-col gap-6">
              <DetailSection title="Details">
                <FieldGrid cols={2}>
                  <Field label="Unit" value={w.unit?.unitNumber ? <span className="font-mono">{w.unit.unitNumber}</span> : 'Common area'} />
                  <Field label="Origin" value={WO_ORIGIN_LABEL[w.originType] ?? w.originType} />
                  <Field label="Source reference" value={w.originId ?? (w.originType === 'MANUAL' ? 'Emergency' : null)} mono />
                  <Field label="Requested" value={w.requestedDate ? formatDate(w.requestedDate) : null} />
                  <Field label="Estimated" value={w.estimatedHours != null ? `${w.estimatedHours}h` : null} mono />
                  <Field label="Actual" value={w.actualHours != null ? `${w.actualHours}h` : null} mono />
                  <Field label="Due" value={w.dueDate ? formatDate(w.dueDate) : null} />
                  <Field label="Completed" value={w.completedDate ? formatDate(w.completedDate) : null} />
                </FieldGrid>
              </DetailSection>
              <DetailSection title="Approval">
                <FieldGrid cols={2}>
                  <Field label="Recommended by" value={w.recommendedById ?? null} mono />
                  <Field label="Approved by" value={w.approvedById ?? null} mono />
                  <Field label="Approved date" value={w.approvedDate ? formatDate(w.approvedDate) : null} />
                  <Field label="Requested by" value={w.requestedById ?? null} mono />
                </FieldGrid>
                {w.rejectionReason && (
                  <p className="mt-3 rounded-control border border-danger-border bg-danger-muted px-3 py-2 text-sm text-danger-fg">
                    Rejected: {w.rejectionReason}
                  </p>
                )}
                {w.status === 'PENDING_APPROVAL' && hasPermission('workorder:approve') && (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Approval remarks — or a reason (required to reject)"
                      className="rounded-control border border-border bg-raised px-3 py-2 text-sm text-strong outline-none transition-shadow focus-visible:shadow-ring" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={onApprove} loading={approve.isPending}><Check className="h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="secondary" onClick={onReject} loading={reject.isPending}><X className="h-4 w-4" /> Reject</Button>
                    </div>
                  </div>
                )}
              </DetailSection>
              <DetailSection title="Estimated cost">
                <FieldGrid cols={2}>
                  <Field label="Labour" value={w.estimatedLabourCost != null ? formatMoney(w.estimatedLabourCost) : null} />
                  <Field label="Material" value={w.estimatedMaterialCost != null ? formatMoney(w.estimatedMaterialCost) : null} />
                  <Field label="Total" value={w.estimatedTotalCost != null ? formatMoney(w.estimatedTotalCost) : null} />
                </FieldGrid>
              </DetailSection>
              <DetailSection title="Assignment">
                <OperationsAssignment communityId={communityId} assignee={w.assignee} canAssign={hasPermission('workorder:assign')} pending={assign.isPending} onAssign={onAssign} />
              </DetailSection>
              <DetailSection title="Verification"><WorkOrderVerification workOrder={w} /></DetailSection>
              <DetailSection title="Timeline"><OperationsTimeline events={timeline.data ?? []} /></DetailSection>
            </div>
          </div>

          {communityId && <WorkOrderForm open={editing} onOpenChange={setEditing} communityId={communityId} workOrder={w} onSaved={() => q.refetch()} />}
        </>
      )}
    </DetailShell>
  );
}
