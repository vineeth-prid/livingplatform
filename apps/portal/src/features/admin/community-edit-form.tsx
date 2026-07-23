import { useQueryClient } from '@tanstack/react-query';
import type { Community } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';

const TYPE_OPTIONS = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'MIXED', label: 'Mixed use' },
  { value: 'COMMERCIAL', label: 'Commercial' },
];
const STATUS_OPTIONS = [
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Community name', required: true, placeholder: 'The Arbour' },
  { name: 'code', label: 'Code', required: true, half: true, placeholder: 'ARB' },
  { name: 'type', label: 'Type', type: 'select', required: true, half: true, options: TYPE_OPTIONS },
  { name: 'status', label: 'Status', type: 'select', half: true, options: STATUS_OPTIONS },
  { name: 'city', label: 'City', half: true },
  { name: 'state', label: 'State', half: true },
  { name: 'contactEmail', label: 'Contact email', type: 'email', half: true },
  { name: 'contactPhone', label: 'Contact phone', type: 'tel', half: true },
];

/** Edit a provisioned community's details (Platform-Admin control plane). */
export function CommunityEditForm({
  community, open, onOpenChange,
}: {
  community: Community;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit community"
      fields={fields}
      submitLabel="Save changes"
      initial={{
        name: community.name, code: community.code, type: community.type,
        status: community.status, city: community.city ?? '', state: community.state ?? '',
        contactEmail: community.contactEmail ?? '', contactPhone: community.contactPhone ?? '',
      }}
      onSubmit={async (values) => {
        const result = await living.community.update(community.id, {
          ...values,
          code: (values.code ?? '').toUpperCase(),
        });
        await qc.invalidateQueries({ queryKey: ['communities'] });
        return result;
      }}
    />
  );
}
