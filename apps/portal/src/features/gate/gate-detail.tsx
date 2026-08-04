import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Ban, Bell, BellOff, Check, Eye, FileText, PackageCheck, Plus, X,
} from 'lucide-react';
import type { GateEntryAction } from '@living/living-sdk';
import { formatDateTime, timeAgo } from '@living/utils';
import {
  Card, LoadingState, PageContainer, PageTransition, Timeline, type TimelineItem,
} from '@living/ui';

import { living } from '../../lib/living';
import { DetailHeader, DetailSection, Field, FieldGrid } from '../master-data';
import { GateStatusBadge, humanize } from './gate-lib';

const ACTION_ICON: Record<GateEntryAction, typeof Plus> = {
  CREATED: Plus,
  NOTIFICATION_SENT: Bell,
  NOTIFICATION_FAILED: BellOff,
  VIEWED: Eye,
  APPROVED: Check,
  REJECTED: X,
  COMPLETED: PackageCheck,
  CANCELLED: Ban,
  NOTE: FileText,
};

const ACTION_LABEL: Record<GateEntryAction, string> = {
  CREATED: 'Recorded at the gate',
  NOTIFICATION_SENT: 'Resident notified',
  NOTIFICATION_FAILED: 'Could not reach the resident',
  VIEWED: 'Resident opened the notification',
  APPROVED: 'Approved by the resident',
  REJECTED: 'Rejected by the resident',
  COMPLETED: 'Handed over',
  CANCELLED: 'Cancelled',
  NOTE: 'Updated',
};

/** One delivery, with the complete audit trail the spec calls for. */
export function GateEntryDetailPage() {
  const { entryId } = useParams({ strict: false }) as { entryId: string };

  const query = useQuery({
    queryKey: ['gate-entry', entryId],
    queryFn: () => living.gate.get(entryId),
    enabled: !!entryId,
  });

  if (query.isLoading) return <LoadingState label="Loading delivery…" />;
  const entry = query.data;
  if (!entry) return <LoadingState label="Not found" />;

  const timeline: TimelineItem[] = (entry.timeline ?? []).map((row) => {
    const Icon = ACTION_ICON[row.action] ?? FileText;
    return {
      id: row.id,
      title: ACTION_LABEL[row.action] ?? humanize(row.action),
      meta: [row.note, row.actorName, row.channel && `via ${row.channel}`]
        .filter(Boolean)
        .join(' · '),
      timestamp: `${formatDateTime(row.createdAt)} (${timeAgo(row.createdAt)})`,
      icon: <Icon className="h-3.5 w-3.5" />,
    };
  });

  return (
    <PageTransition>
      <PageContainer>
        <DetailHeader
          showAvatar={false}
          title={`${entry.vendorName ?? 'Delivery'} · ${entry.personName}`}
          subtitle={`${entry.entryNumber} · ${entry.gate?.name ?? 'Main Gate'}`}
          status={<GateStatusBadge status={entry.status} size="md" />}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <DetailSection title="Delivery">
              <FieldGrid>
                <Field label="Vendor" value={entry.vendorName} />
                <Field label="Type" value={entry.deliveryType ? humanize(entry.deliveryType) : null} />
                <Field label="Person" value={entry.personName} />
                <Field label="Phone" value={entry.mobileNumber} mono />
                <Field label="Vehicle" value={entry.vehicleNumber} mono />
                <Field label="Arrived" value={formatDateTime(entry.createdAt)} />
              </FieldGrid>
              {entry.remarks && (
                <p className="mt-3 rounded-control bg-sunken px-3 py-2 text-sm text-body">
                  {entry.remarks}
                </p>
              )}
            </DetailSection>

            <DetailSection title="Destination">
              <FieldGrid>
                <Field label="Apartment" value={entry.unit?.unitNumber} mono />
                <Field
                  label="Resident"
                  value={
                    entry.resident
                      ? `${entry.resident.firstName} ${entry.resident.lastName}`
                      : 'No resident linked'
                  }
                />
                <Field label="Resident phone" value={entry.resident?.mobile} mono />
              </FieldGrid>
            </DetailSection>

            <DetailSection title="Decision">
              <FieldGrid>
                <Field
                  label="Notified"
                  value={entry.notifiedAt ? formatDateTime(entry.notifiedAt) : 'Never reached'}
                />
                <Field label="Opened" value={entry.viewedAt ? formatDateTime(entry.viewedAt) : '—'} />
                <Field label="Decided" value={entry.decidedAt ? formatDateTime(entry.decidedAt) : '—'} />
                <Field label="Completed" value={entry.completedAt ? formatDateTime(entry.completedAt) : '—'} />
              </FieldGrid>
              {entry.decisionNote && (
                <p className="mt-3 text-sm italic text-muted">“{entry.decisionNote}”</p>
              )}
            </DetailSection>
          </div>

          <div className="flex flex-col gap-6">
            {entry.photoUrl && (
              <DetailSection title="Gate photo">
                <a href={entry.photoUrl} target="_blank" rel="noreferrer">
                  <img
                    src={entry.photoUrl}
                    alt="Taken at the gate"
                    className="w-full rounded-control object-cover"
                  />
                </a>
              </DetailSection>
            )}

            <DetailSection title="Audit trail">
              {timeline.length === 0 ? (
                <p className="text-sm text-subtle">Nothing recorded yet.</p>
              ) : (
                <Card variant="elevated">
                  <Timeline items={timeline} />
                </Card>
              )}
            </DetailSection>
          </div>
        </div>
      </PageContainer>
    </PageTransition>
  );
}
