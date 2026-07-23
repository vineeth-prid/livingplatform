import { useQueryClient } from '@tanstack/react-query';
import type { Staff } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, PERSON_STATUS } from '../master-data/options';
import { CatalogSelect } from '../shared/catalog-select';

const fields: FieldDef[] = [
  { name: 'firstName', label: 'First name', required: true, half: true },
  { name: 'lastName', label: 'Last name', required: true, half: true },
  {
    name: 'role', label: 'Role', type: 'custom', required: true, half: true,
    render: (value, set, error) => (
      <CatalogSelect kind="STAFF_ROLE" label="Role" required value={value} onChange={set} error={error} />
    ),
  },
  { name: 'department', label: 'Department', half: true },
  { name: 'phone', label: 'Phone (login username)', type: 'tel', required: true, half: true },
  { name: 'email', label: 'Email', type: 'email', half: true },
  { name: 'status', label: 'Status', type: 'select', options: opt(PERSON_STATUS), half: true },
];

export function StaffForm({
  open, onOpenChange, communityId, staff, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  staff?: Staff;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!staff;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit staff' : 'Add staff'}
      description={editing ? undefined : 'A login is created — username is the phone number, password Living@123 (changed on first sign-in).'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add staff'}
      initial={
        editing
          ? {
              firstName: staff.firstName, lastName: staff.lastName,
              role: staff.role, department: staff.department ?? '', phone: staff.phone,
              email: staff.email ?? '', status: staff.status,
            }
          : {}
      }
      onSubmit={async (values) => {
        const result = editing
          ? await living.people.updateStaff(staff.id, values)
          : await living.people.createStaff(communityId, values);
        await qc.invalidateQueries({ queryKey: ['staff'] });
        if (editing) await qc.invalidateQueries({ queryKey: ['staff-member', staff.id] });
        onSaved?.();
        return result;
      }}
    />
  );
}
