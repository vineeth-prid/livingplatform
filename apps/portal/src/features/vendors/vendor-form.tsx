import { useQueryClient } from '@tanstack/react-query';
import type { Vendor } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, PERSON_STATUS, VENDOR_CATEGORY } from '../master-data/options';

const fields: FieldDef[] = [
  { name: 'name', label: 'Contact name', required: true, half: true },
  { name: 'companyName', label: 'Company', half: true },
  { name: 'category', label: 'Category', type: 'select', options: opt(VENDOR_CATEGORY), required: true, half: true },
  { name: 'status', label: 'Status', type: 'select', options: opt(PERSON_STATUS), half: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, half: true },
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
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add vendor'}
      initial={
        editing
          ? {
              name: vendor.name, companyName: vendor.companyName ?? '', category: vendor.category,
              status: vendor.status, phone: vendor.phone, email: vendor.email ?? '',
              city: vendor.city ?? '', code: vendor.code ?? '',
              addressLine: (vendor as { addressLine?: string }).addressLine ?? '',
              remarks: vendor.remarks ?? '',
            }
          : {}
      }
      onSubmit={async (values) => {
        const result = editing
          ? await living.people.updateVendor(vendor.id, values)
          : await living.people.createVendor(values);
        await qc.invalidateQueries({ queryKey: ['vendors'] });
        if (editing) await qc.invalidateQueries({ queryKey: ['vendor', vendor.id] });
        onSaved?.();
        return result;
      }}
    />
  );
}
