import { useQueryClient } from '@tanstack/react-query';
import type { Vendor } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, PERSON_STATUS } from '../master-data/options';
import { CatalogMultiSelect, CatalogSelect } from '../shared/catalog-select';

const fields: FieldDef[] = [
  { name: 'name', label: 'Contact name', required: true, half: true },
  { name: 'companyName', label: 'Company', half: true },
  {
    name: 'category', label: 'Primary category', type: 'custom', required: true, half: true,
    render: (value, set, error) => (
      <CatalogSelect kind="VENDOR_CATEGORY" label="Primary category" required value={value} onChange={set} error={error} />
    ),
  },
  { name: 'status', label: 'Status', type: 'select', options: opt(PERSON_STATUS), half: true },
  {
    name: 'serviceCategories', label: 'Service categories', type: 'custom',
    render: (value, set) => (
      <CatalogMultiSelect
        kind="VENDOR_CATEGORY" label="Service categories"
        values={value ? value.split(',').filter(Boolean) : []}
        onChange={(vals) => set(vals.join(','))}
      />
    ),
  },
  { name: 'phone', label: 'Phone (login username)', type: 'tel', required: true, half: true },
  { name: 'email', label: 'Email', type: 'email', half: true },
  { name: 'city', label: 'City', half: true },
  { name: 'code', label: 'Code', half: true, placeholder: 'V-ELE-001' },
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
              city: vendor.city ?? '', code: vendor.code ?? '',
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
