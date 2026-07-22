import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, toast, useConfirm } from '@living/ui';
import { Pencil, Archive } from 'lucide-react';
import { formatDate } from '@living/utils';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid, PlaceholderSection, StatusBadge,
} from '../master-data';
import { ResidentForm } from './resident-form';

export function ResidentDetailPage() {
  const { residentId } = useParams({ strict: false }) as { residentId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const q = useQuery({
    queryKey: ['resident', residentId],
    queryFn: () => living.people.getResident(residentId),
  });
  const r = q.data;
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onArchive() {
    if (!r) return;
    const ok = await confirm({
      title: 'Archive this resident?',
      description: `${r.firstName} ${r.lastName} will be removed from active lists.`,
      tone: 'danger', confirmLabel: 'Archive',
    });
    if (!ok) return;
    try {
      await living.people.deleteResident(r.id);
      toast.success('Resident archived');
      navigate({ to: '/residents' as string });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not archive');
    }
  }

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/residents">
      {r && (
        <>
          <DetailHeader
            name={`${r.firstName} ${r.lastName}`}
            avatarUrl={r.photoUrl}
            title={`${r.firstName} ${r.lastName}`}
            subtitle={r.occupation}
            status={<StatusBadge status={r.status} size="md" />}
            meta={
              <>
                <span className="font-mono">{r.residentCode}</span>
                {r.moveInDate && <span>Moved in {formatDate(r.moveInDate)}</span>}
              </>
            }
            actions={
              <>
                {hasPermission('resident:update') && (
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {hasPermission('resident:delete') && (
                  <Button variant="ghost" onClick={onArchive} aria-label="Archive">
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Contact">
                <FieldGrid>
                  <Field label="Mobile" value={r.mobile} mono />
                  <Field label="Email" value={r.email} />
                  <Field label="Gender" value={r.gender ? r.gender.toLowerCase() : null} />
                  <Field label="Occupation" value={r.occupation} />
                </FieldGrid>
              </DetailSection>

              <DetailSection title="Emergency contact">
                <FieldGrid>
                  <Field label="Name" value={r.emergencyContactName} />
                  <Field label="Phone" value={r.emergencyContactPhone} mono />
                  <Field label="Relationship" value={r.emergencyContactRelationship} />
                </FieldGrid>
              </DetailSection>

              <PlaceholderSection title="Timeline" note="Resident activity will appear here as modules come online." />
            </div>

            <div className="flex flex-col gap-6">
              <DetailSection title="Unit">
                {r.unitAssignment?.unit ? (
                  <FieldGrid cols={2}>
                    <Field label="Unit" value={<span className="font-mono">{r.unitAssignment.unit.unitNumber}</span>} />
                    <Field label="Role" value={r.unitAssignment.role.toLowerCase()} />
                    <Field label="Status" value={<StatusBadge status={r.unitAssignment.status} />} />
                  </FieldGrid>
                ) : (
                  <p className="text-sm text-subtle">Not assigned to a unit.</p>
                )}
              </DetailSection>

              <PlaceholderSection title="Tickets" note="A summary of this resident’s tickets will appear here." />
            </div>
          </div>

          {communityId && (
            <ResidentForm
              open={editing}
              onOpenChange={setEditing}
              communityId={communityId}
              resident={r}
              onSaved={() => q.refetch()}
            />
          )}
        </>
      )}
    </DetailShell>
  );
}
