import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Archive, Pencil } from 'lucide-react';
import { formatDate } from '@living/utils';
import { Button, toast, useConfirm } from '@living/ui';
import type { ServiceRequestStatus } from '@living/types';

import { useCommunity } from '../community/community-context';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid, PlaceholderSection,
} from '../master-data';
import { OperationsAssignment, OperationsStatusMenu, PriorityPill, StatusPill } from '../operations';
import { SR_TONES, srWorkflow } from './config';
import { ServiceFeedback } from './sr-feedback';
import { ServiceScheduling } from './sr-scheduling';
import { ServiceRequestForm } from './sr-form';
import { useServiceRequest, useServiceRequestMutations } from './queries';

import { living } from '../../lib/living';

export function ServiceRequestDetailPage() {
  const { serviceRequestId } = useParams({ strict: false }) as { serviceRequestId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const q = useServiceRequest(serviceRequestId);
  const r = q.data;
  const { changeStatus, assign } = useServiceRequestMutations(serviceRequestId);
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onStatus(to: ServiceRequestStatus) {
    try { await changeStatus.mutateAsync({ status: to }); toast.success('Status updated'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not update'); }
  }
  async function onAssign(input: { staffId?: string; vendorId?: string }) {
    try { await assign.mutateAsync(input); toast.success('Assigned'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not assign'); }
  }
  async function onDelete() {
    if (!r) return;
    if (!(await confirm({ title: `Cancel ${r.requestNumber}?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try { await living.serviceRequest.remove(r.id); toast.success('Request removed'); navigate({ to: '/service-requests' as string }); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not remove'); }
  }

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/service-requests">
      {r && (
        <>
          <DetailHeader
            showAvatar={false}
            title={r.title}
            subtitle={<span className="font-mono text-sm">{r.requestNumber}</span>}
            status={<StatusPill status={r.status} tones={SR_TONES} size="md" />}
            meta={<><PriorityPill priority={r.priority} /><span>Raised {formatDate(r.createdAt)}</span></>}
            actions={
              <>
                <OperationsStatusMenu status={r.status} workflow={srWorkflow} onChange={onStatus} pending={changeStatus.isPending} />
                {hasPermission('service:update') && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
                {hasPermission('service:cancel') && <Button variant="ghost" onClick={onDelete} aria-label="Remove"><Archive className="h-4 w-4" /></Button>}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Description"><p className="whitespace-pre-wrap text-sm text-body">{r.description}</p></DetailSection>
              <DetailSection title="Scheduling">
                <ServiceScheduling request={r} canEdit={hasPermission('service:update')} />
              </DetailSection>
              <DetailSection title="Feedback"><ServiceFeedback request={r} /></DetailSection>
              <PlaceholderSection title="Activity" note="Comments, attachments and a full timeline arrive when the service-request engine gains them." />
            </div>

            <div className="flex flex-col gap-6">
              <DetailSection title="Details">
                <FieldGrid cols={2}>
                  <Field label="Service" value={r.service?.name} />
                  <Field label="Priority" value={<PriorityPill priority={r.priority} />} />
                  <Field label="Unit" value={r.unit?.unitNumber ? <span className="font-mono">{r.unit.unitNumber}</span> : null} />
                  <Field label="Completed" value={r.completedDate ? formatDate(r.completedDate) : null} />
                </FieldGrid>
              </DetailSection>
              <DetailSection title="Assignment">
                <OperationsAssignment communityId={communityId} assignee={r.assignee} canAssign={hasPermission('service:assign')} pending={assign.isPending} onAssign={onAssign} />
              </DetailSection>
              <PlaceholderSection title="Related ticket" note={r.ticketId ? `Linked to ticket ${r.ticketId}` : 'No linked ticket.'} />
            </div>
          </div>

          {communityId && <ServiceRequestForm open={editing} onOpenChange={setEditing} communityId={communityId} request={r} onSaved={() => q.refetch()} />}
        </>
      )}
    </DetailShell>
  );
}
