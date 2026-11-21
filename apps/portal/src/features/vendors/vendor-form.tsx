import { useQueryClient } from '@tanstack/react-query';
import type { CommissionModel, PayoutFrequency } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import type { Vendor } from '@living/types';
import { toast } from '@living/ui';

import { living } from '../../lib/living';
import { announceTemporaryPassword } from '../shared/reset-password-button';
import { useCommunity } from '../community/community-context';
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

/**
 * Commission terms captured with a NEW vendor (saved as their first terms,
 * effective today, right after the vendor is created). Later changes are made
 * on the vendor page, where each change starts on its own date.
 */
const COMMISSION_FIELDS: FieldDef[] = [
  {
    name: 'commissionModel', label: 'Commission', type: 'select', half: true, required: true,
    options: [
      { value: 'PERCENTAGE', label: 'Percentage of service amount' },
      { value: 'FIXED', label: 'Fixed amount per service' },
      { value: 'NONE', label: 'No commission' },
    ],
  },
  { name: 'commissionValue', label: 'Commission % or ₹ per service', type: 'number', min: '0', half: true, placeholder: 'e.g. 10' },
  {
    name: 'payoutFrequency', label: 'Payout frequency', type: 'select', half: true, required: true,
    options: [{ value: 'WEEKLY', label: 'Weekly (Mon–Sun)' }, { value: 'MONTHLY', label: 'Monthly' }],
  },
];
const COMMISSION_KEYS = COMMISSION_FIELDS.map((f) => f.name);

export function VendorForm({
  open, onOpenChange, vendor, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const editing = !!vendor;
  const withCommission = !editing && !!communityId && hasPermission('vendor-finance:manage');

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit vendor' : 'Add vendor'}
      description={editing ? undefined : 'A login is created — username is the phone number, with a one-time password shown to you after saving (changed on first sign-in).'}
      fields={withCommission ? [...fields, ...COMMISSION_FIELDS] : fields}
      submitLabel={editing ? 'Save changes' : 'Add vendor'}
      initial={
        withCommission
          ? { commissionModel: 'PERCENTAGE', commissionValue: '10', payoutFrequency: 'MONTHLY' }
          : editing
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
      onSubmit={async (allValues) => {
        // Commission is its own record, not a vendor field — split it off
        // (the vendor API rejects unknown fields) and check it BEFORE creating
        // anything, so a bad rate never leaves a vendor without terms.
        const values = Object.fromEntries(Object.entries(allValues).filter(([k]) => !COMMISSION_KEYS.includes(k)));
        const model = allValues.commissionModel as CommissionModel | undefined;
        const amount = Number(allValues.commissionValue);
        if (withCommission && model && model !== 'NONE') {
          if (!(amount > 0)) throw new Error('Enter the commission % or amount (or choose “No commission”)');
          if (model === 'PERCENTAGE' && amount > 100) throw new Error('A commission percentage cannot be above 100');
        }
        const body = {
          ...values,
          serviceCategories: values.serviceCategories
            ? values.serviceCategories.split(',').filter(Boolean)
            : [],
          // Coverage. A vendor is scoped by `communityIds[]`, and this form
          // never sent one — so every vendor was created covering NOTHING.
          // Auto-assignment skipped them, manual assignment answered "vendor
          // does not cover this community", and AMCs could not be raised
          // against them. Adding a vendor from a community means they serve
          // that community; anything wider is a platform decision.
          ...(editing || !communityId ? {} : { communityIds: [communityId] }),
        };
        const result = editing
          ? await living.people.updateVendor(vendor.id, body)
          : await living.people.createVendor(body);
        if (!editing) announceTemporaryPassword(String(values.name ?? 'the vendor'), result);
        if (withCommission && model) {
          // The vendor already exists at this point: a failure here must not
          // throw (a retry would create a second vendor) — say what to do instead.
          try {
            await living.vendorFinance.addCommission(communityId!, (result as Vendor).id, {
              model,
              payoutFrequency: (allValues.payoutFrequency as PayoutFrequency) ?? 'MONTHLY',
              effectiveFrom: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
              ...(model === 'PERCENTAGE' ? { rate: amount } : model === 'FIXED' ? { fixedAmount: amount } : {}),
            });
          } catch {
            toast.error('Vendor added, but the commission terms were not saved — set them on the vendor page');
          }
        }
        await qc.invalidateQueries({ queryKey: ['vendors'] });
        if (editing) await qc.invalidateQueries({ queryKey: ['vendor', vendor.id] });
        onSaved?.();
        return result;
      }}
    />
  );
}
