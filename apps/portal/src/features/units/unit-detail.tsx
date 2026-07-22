import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Pencil } from 'lucide-react';
import { Avatar, Button, EmptyState } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid, StatusBadge,
} from '../master-data';
import { UnitForm } from './unit-form';

const ownershipLabel = (o: string) => o.charAt(0) + o.slice(1).toLowerCase().replace(/_/g, ' ');

interface UnitWithRelations {
  block?: { name: string; code: string } | null;
  floor?: { level: number; name?: string | null } | null;
  phase?: { name: string } | null;
}

export function UnitDetailPage() {
  const { unitId } = useParams({ strict: false }) as { unitId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState(false);

  const q = useQuery({ queryKey: ['unit', unitId], queryFn: () => living.community.getUnit(unitId) });
  const u = q.data as (typeof q.data & UnitWithRelations) | undefined;
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  // Residents living in this unit.
  const residents = useQuery({
    queryKey: ['units', unitId, 'residents'],
    queryFn: () => living.people.listResidents(communityId!, { unitId, limit: 20 }),
    enabled: !!communityId && !!u,
  });

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/units">
      {u && (
        <>
          <DetailHeader
            showAvatar={false}
            title={<span className="font-mono">{u.unitNumber}</span>}
            subtitle={[u.block?.name, u.floor ? (u.floor.name ?? `Level ${u.floor.level}`) : null].filter(Boolean).join(' · ') || undefined}
            status={<StatusBadge status={u.status} size="md" />}
            meta={u.type ? <span>{u.type}</span> : undefined}
            actions={
              hasPermission('unit:update') && (
                <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
              )
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Specification">
                <FieldGrid cols={3}>
                  <Field label="Type" value={u.type} />
                  <Field label="Bedrooms" value={u.bedrooms} mono />
                  <Field label="Bathrooms" value={u.bathrooms} mono />
                  <Field label="Built-up area" value={u.builtUpArea ? `${u.builtUpArea} ${u.areaUnit}` : null} mono />
                  <Field label="Parking" value={u.parkingSlots} mono />
                  <Field label="Ownership" value={ownershipLabel(u.ownership)} />
                </FieldGrid>
              </DetailSection>

              <DetailSection title={`Residents${residents.data ? ` (${residents.data.meta.total})` : ''}`}>
                {residents.data && residents.data.items.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {residents.data.items.map((r) => (
                      <li key={r.id}>
                        <Link
                          to={`/residents/${r.id}` as string}
                          className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sunken"
                        >
                          <Avatar name={`${r.firstName} ${r.lastName}`} src={r.photoUrl} size="sm" />
                          <span className="flex-1 text-sm font-medium text-strong">{r.firstName} {r.lastName}</span>
                          {r.unitAssignment && <StatusBadge status={r.unitAssignment.role} />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No residents" description="No one is assigned to this unit yet." />
                )}
              </DetailSection>
            </div>

            <DetailSection title="Placement">
              <FieldGrid cols={2}>
                <Field label="Phase" value={u.phase?.name} />
                <Field label="Block" value={u.block ? `${u.block.name} (${u.block.code})` : null} />
                <Field label="Floor" value={u.floor ? (u.floor.name ?? `Level ${u.floor.level}`) : null} />
              </FieldGrid>
            </DetailSection>
          </div>

          {communityId && (
            <UnitForm open={editing} onOpenChange={setEditing} communityId={communityId} unit={u} onSaved={() => q.refetch()} />
          )}
        </>
      )}
    </DetailShell>
  );
}
