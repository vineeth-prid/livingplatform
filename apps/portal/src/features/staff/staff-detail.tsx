import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Archive, Pencil } from 'lucide-react';
import { Badge, Button, toast, useConfirm } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid, PlaceholderSection, StatusBadge,
} from '../master-data';
import { StaffForm } from './staff-form';

const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');

export function StaffDetailPage() {
  const { staffId } = useParams({ strict: false }) as { staffId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const q = useQuery({ queryKey: ['staff-member', staffId], queryFn: () => living.people.getStaff(staffId) });
  const s = q.data;
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onArchive() {
    if (!s) return;
    const ok = await confirm({ title: 'Archive this staff member?', tone: 'danger', confirmLabel: 'Archive' });
    if (!ok) return;
    try {
      await living.people.deleteStaff(s.id);
      toast.success('Staff archived');
      navigate({ to: '/staff' as string });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not archive');
    }
  }

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/staff">
      {s && (
        <>
          <DetailHeader
            name={`${s.firstName} ${s.lastName}`}
            avatarUrl={s.photoUrl}
            title={`${s.firstName} ${s.lastName}`}
            subtitle={<Badge tone="brand" size="sm">{roleLabel(s.role)}</Badge>}
            status={<StatusBadge status={s.status} size="md" />}
            meta={<span className="font-mono">{s.employeeId}</span>}
            actions={
              <>
                {hasPermission('staff:update') && (
                  <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                )}
                {hasPermission('staff:delete') && (
                  <Button variant="ghost" onClick={onArchive} aria-label="Archive"><Archive className="h-4 w-4" /></Button>
                )}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Details">
                <FieldGrid>
                  <Field label="Role" value={roleLabel(s.role)} />
                  <Field label="Department" value={s.department} />
                  <Field label="Phone" value={s.phone} mono />
                  <Field label="Email" value={s.email} />
                </FieldGrid>
              </DetailSection>
              <PlaceholderSection title="Current workload" note="Assigned tickets and work orders will appear here." />
            </div>
            <DetailSection title="Access">
              <p className="text-sm text-muted">
                {s.userId
                  ? 'Linked to a platform login — permissions follow their assigned role.'
                  : 'No platform login linked yet.'}
              </p>
            </DetailSection>
          </div>

          {communityId && (
            <StaffForm open={editing} onOpenChange={setEditing} communityId={communityId} staff={s} onSaved={() => q.refetch()} />
          )}
        </>
      )}
    </DetailShell>
  );
}
