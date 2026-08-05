import { useQueryClient } from '@tanstack/react-query';
import type { Vendor } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, PERSON_STATUS } from '../master-data/options';
import { ServicesMultiSelect } from '../shared/services-multi-select';

/**
 * "Primary category" has moved to the STAFF form.
 *
 * It bound to the same VENDOR_CATEGORY option list as "Service categories", so
 * both fields always showed identical choices and the primary one carried no
 * extra information. Speciality matters for STAFF (it routes a request to the
 * right person); for a vendor what matters is which SERVICES they deliver, and
 * those now come from the community's own services catalog rather than a
 * parallel free-text list. The API derives the stored `category` from the first
 * service selected, so reporting is unchanged.
 */
const fields: FieldDef[] = [
  { name: 'name', label: 'Contact name', required: true, half: true },
  { name: 'companyName', label: 'Company', half: true },
  { name: 'status', label: 'Status', type: 'select', options: opt(PERSON_STATUS), half: true },
  {
    name: 'serviceCategories', label: 'Services delivered', type: 'custom',
    render: (value, set) => (
      <ServicesMultiSelect
        values={value ? value.split(',').filter(Boolean) : []}
        onChange={(vals) => set(vals.join(','))}
      />
    ),
  },
  { name: 'phone', label: 'Phone (login username)', type: 'tel', required: true, half: true },
  { name: 'email', label: 'Email', type: 'email', half: true },
  { name: 'city', label: 'City', half: true },
  { name: 'addressLine', label: 'Address' },
  { name: 'remarks', label: 'Remarks', type: 'textarea' },
];

export function VendorForm({
  open, onOpenChange, vendor, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!vendor;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit vendor' : 'Add vendor'}
      description={editing ? undefined : 'A login is created — username is the phone number, password Living@123 (changed on first sign-in).'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add vendor'}
      initial={
        editing
          ? {
              name: vendor.name, companyName: vendor.companyName ?? '', category: vendor.category,
              serviceCategories: (vendor.serviceCategories ?? []).join(','),
              status: vendor.status, phone: vendor.phone, email: vendor.email ?? '',
              city: vendor.city ?? '',
              addressLine: (vendor as { addressLine?: string }).addressLine ?? '',
              remarks: vendor.remarks ?? '',
            }
          : {}
      }
      onSubmit={async (values) => {
        const body = {
          ...values,
          serviceCategories: values.serviceCategories
            ? values.serviceCategories.split(',').filter(Boolean)
            : [],
        };
        const result = editing
          ? await living.people.updateVendor(vendor.id, body)
          : await living.people.createVendor(body);
        await qc.invalidateQueries({ queryKey: ['vendors'] });
        if (editing) await qc.invalidateQueries({ queryKey: ['vendor', vendor.id] });
        onSaved?.();
        return result;
      }}
    />
  );
}
