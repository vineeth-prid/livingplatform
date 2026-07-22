import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Archive, Pencil } from 'lucide-react';
import { Badge, Button, toast, useConfirm } from '@living/ui';

import { living } from '../../lib/living';
import {
  DetailHeader, DetailSection, DetailShell, Field, FieldGrid, PlaceholderSection, StatusBadge,
} from '../master-data';
import { VendorForm } from './vendor-form';

const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');

export function VendorDetailPage() {
  const { vendorId } = useParams({ strict: false }) as { vendorId: string };
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const q = useQuery({ queryKey: ['vendor', vendorId], queryFn: () => living.people.getVendor(vendorId) });
  const v = q.data;
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onArchive() {
    if (!v) return;
    const ok = await confirm({ title: 'Archive this vendor?', tone: 'danger', confirmLabel: 'Archive' });
    if (!ok) return;
    try {
      await living.people.deleteVendor(v.id);
      toast.success('Vendor archived');
      navigate({ to: '/vendors' as string });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not archive');
    }
  }

  return (
    <DetailShell isLoading={q.isLoading} isError={q.isError && !notFound} error={q.error} notFound={notFound} backTo="/vendors">
      {v && (
        <>
          <DetailHeader
            name={v.companyName || v.name}
            showAvatar
            title={v.companyName || v.name}
            subtitle={v.companyName ? v.name : undefined}
            status={<StatusBadge status={v.status} size="md" />}
            meta={<Badge tone="brand" size="sm">{catLabel(v.category)}</Badge>}
            actions={
              <>
                {hasPermission('vendor:update') && (
                  <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                )}
                {hasPermission('vendor:delete') && (
                  <Button variant="ghost" onClick={onArchive} aria-label="Archive"><Archive className="h-4 w-4" /></Button>
                )}
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <DetailSection title="Contact">
                <FieldGrid>
                  <Field label="Phone" value={v.phone} mono />
                  <Field label="Email" value={v.email} />
                  <Field label="City" value={v.city} />
                  <Field label="Code" value={v.code ? <span className="font-mono">{v.code}</span> : null} />
                </FieldGrid>
              </DetailSection>

              <DetailSection title="Services">
                {v.serviceCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {v.serviceCategories.map((c) => (
                      <Badge key={c} tone="neutral" size="sm">{catLabel(c)}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-subtle">No additional service categories.</p>
                )}
              </DetailSection>

              <PlaceholderSection title="Assigned work" note="Work orders and service requests assigned to this vendor will appear here." />
            </div>

            <div className="flex flex-col gap-6">
              <DetailSection title="Coverage">
                <Field label="Communities served" value={`${v.communityIds.length}`} mono />
              </DetailSection>
              {v.remarks && (
                <DetailSection title="Remarks">
                  <p className="text-sm text-body">{v.remarks}</p>
                </DetailSection>
              )}
            </div>
          </div>

          <VendorForm open={editing} onOpenChange={setEditing} vendor={v} onSaved={() => q.refetch()} />
        </>
      )}
    </DetailShell>
  );
}
