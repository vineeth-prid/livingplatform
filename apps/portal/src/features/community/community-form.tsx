import { useQueryClient } from '@tanstack/react-query';
import type { Community } from '@living/types';

import { living } from '../../lib/living';
import { useCommunity } from './community-context';
import { FormDrawer, type FieldDef } from '../master-data';

const TYPE_OPTIONS = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'MIXED', label: 'Mixed use' },
  { value: 'COMMERCIAL', label: 'Commercial' },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Community name', required: true, placeholder: 'The Arbour' },
  { name: 'code', label: 'Admin code', required: true, half: true, placeholder: 'ARB' },
  { name: 'type', label: 'Type', type: 'select', required: true, half: true, options: TYPE_OPTIONS },
  { name: 'city', label: 'City', half: true },
  { name: 'state', label: 'State', half: true },
  { name: 'contactEmail', label: 'Contact email', type: 'email' },
];

/**
 * Create a new community for the caller's tenant. Tenant-scoped admins (e.g. the
 * Association Admin) need no tenantId — the API resolves it from their token.
 * Platform Admins have no tenant and must provision via tenant management (not
 * yet surfaced) — see the onboarding gap. On success the new community becomes
 * active so the rest of the app is immediately usable.
 */
export function CommunityForm({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { setCommunityId } = useCommunity();

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New community"
      description="Set up a community. You can add its blocks, units and amenities next."
      fields={fields}
      submitLabel="Create community"
      onSubmit={async (values) => {
        const created = (await living.community.create({
          ...values,
          code: (values.code ?? '').toUpperCase(),
        })) as Community;
        await qc.invalidateQueries({ queryKey: ['communities'] });
        setCommunityId(created.id);
        return created;
      }}
    />
  );
}
