import { useQueryClient } from '@tanstack/react-query';
import type { ProvisionCommunityResult } from '@living/living-sdk';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';

const TYPE_OPTIONS = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'MIXED', label: 'Mixed use' },
  { value: 'COMMERCIAL', label: 'Commercial' },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Community name', required: true, placeholder: 'The Arbour' },
  { name: 'code', label: 'Code', required: true, half: true, placeholder: 'ARB' },
  { name: 'type', label: 'Type', type: 'select', required: true, half: true, options: TYPE_OPTIONS },
  { name: 'city', label: 'City', half: true },
  { name: 'state', label: 'State', half: true },
  { name: 'adminFirstName', label: 'Admin first name', required: true, half: true },
  { name: 'adminLastName', label: 'Admin last name', required: true, half: true },
  { name: 'adminEmail', label: 'Association admin email', type: 'email', required: true, placeholder: 'admin@thearbour.com' },
];

/**
 * Platform-Admin provisioning drawer: create a community and its Association
 * Admin in one call. The one-time password comes back in the result and is
 * surfaced by the page (shown once).
 */
export function ProvisionCommunityForm({
  open, onOpenChange, onProvisioned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned: (result: ProvisionCommunityResult) => void;
}) {
  const qc = useQueryClient();

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Provision community"
      description="Creates the community and its Association Admin. Share the one-time password with them; they sign in and build it out."
      fields={fields}
      submitLabel="Provision"
      onSubmit={async (values) => {
        const result = await living.platform.provisionCommunity({
          name: values.name ?? '',
          code: (values.code ?? '').toUpperCase(),
          type: values.type ?? '',
          city: values.city,
          state: values.state,
          adminEmail: values.adminEmail ?? '',
          adminFirstName: values.adminFirstName ?? '',
          adminLastName: values.adminLastName ?? '',
        });
        await qc.invalidateQueries({ queryKey: ['communities'] });
        onProvisioned(result);
        return result;
      }}
    />
  );
}
