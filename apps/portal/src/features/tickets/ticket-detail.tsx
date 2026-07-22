import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Archive, Pencil } from 'lucide-react';
import { formatDate } from '@living/utils';
import { Button, toast, useConfirm } from '@living/ui';
import type { Ticket, TicketStatus } from '@living/types';

import { useCommunity } from '../community/community-context';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid, PlaceholderSection,
} from '../master-data';
import { PriorityBadge, TicketStatusBadge } from './ticket-badges';
import { TicketAssignment } from './ticket-assignment';
import { TicketAttachments } from './ticket-attachments';
import { TicketComments } from './ticket-comments';
import { TicketForm } from './ticket-form';
import { TicketStatusMenu } from './ticket-status-menu';
import { TicketTimeline } from './ticket-timeline';
import { useTicket, useTicketMutations } from './queries';

// The ticket detail (get) embeds these relations.
type TicketDetail = Ticket & {
  comments?: import('@living/types').TicketComment[];
  attachments?: import('@living/types').TicketAttachment[];
  timeline?: import('@living/types').TimelineEvent[];
};

export function TicketDetailPage() {
  const { ticketId } = useParams({ strict: false }) as { ticketId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const q = useTicket(ticketId);
  const t = q.data as TicketDetail | undefined;
  const { changeStatus, remove } = useTicketMutations(ticketId);
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onStatus(to: TicketStatus) {
    try {
      await changeStatus.mutateAsync({ status: to });
      toast.success('Status updated');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not update status');
    }
  }

  async function onDelete() {
    if (!t) return;
    const ok = await confirm({ title: `Delete ${t.ticketNumber}?`, tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await remove.mutateAsync();
      toast.success('Ticket deleted');
      navigate({ to: '/tickets' as string });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not delete');
    }
  }

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/tickets">
      {t && (
        <>
          <DetailHeader
            showAvatar={false}
            title={t.title}
            subtitle={<span className="font-mono text-sm">{t.ticketNumber}</span>}
            status={<TicketStatusBadge status={t.status} size="md" />}
            meta={<><PriorityBadge priority={t.priority} /><span>Raised {formatDate(t.createdAt)}</span></>}
            actions={
              <>
                <TicketStatusMenu status={t.status} onChange={onStatus} pending={changeStatus.isPending} />
                {hasPermission('ticket:update') && (
                  <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                )}
                {hasPermission('ticket:delete') && (
                  <Button variant="ghost" onClick={onDelete} aria-label="Delete"><Archive className="h-4 w-4" /></Button>
                )}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Conversation-first main column */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Description">
                <p className="whitespace-pre-wrap text-sm text-body">{t.description}</p>
              </DetailSection>

              <DetailSection title="Comments">
                <TicketComments ticketId={t.id} comments={t.comments ?? []} />
              </DetailSection>

              <DetailSection title="Attachments">
                <TicketAttachments ticketId={t.id} attachments={t.attachments ?? []} />
              </DetailSection>
            </div>

            {/* Context sidebar */}
            <div className="flex flex-col gap-6">
              <DetailSection title="Details">
                <FieldGrid cols={2}>
                  <Field label="Category" value={t.category?.name} />
                  <Field label="Priority" value={<PriorityBadge priority={t.priority} />} />
                  <Field label="Unit" value={t.unit?.unitNumber ? <span className="font-mono">{t.unit.unitNumber}</span> : null} />
                  <Field label="Resident" value={t.resident ? `${t.resident.firstName} ${t.resident.lastName}` : null} />
                  <Field label="Source" value={t.source.replace(/_/g, ' ').toLowerCase()} />
                  <Field label="Due" value={t.dueDate ? formatDate(t.dueDate) : null} />
                </FieldGrid>
              </DetailSection>

              <DetailSection title="Assignment">
                <TicketAssignment ticketId={t.id} communityId={communityId} assignee={t.assignee} />
              </DetailSection>

              <DetailSection title="Timeline">
                <TicketTimeline events={t.timeline ?? []} />
              </DetailSection>

              <PlaceholderSection title="Related work" note="Linked work orders and service requests will appear here." />
            </div>
          </div>

          {communityId && (
            <TicketForm open={editing} onOpenChange={setEditing} communityId={communityId} ticket={t} onSaved={() => q.refetch()} />
          )}
        </>
      )}
    </DetailShell>
  );
}
