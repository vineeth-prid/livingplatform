import { useQueryClient } from '@tanstack/react-query';
import type { Staff } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, PERSON_STATUS, STAFF_ROLE } from '../master-data/options';

const fields: FieldDef[] = [
  { name: 'firstName', label: 'First name', required: true, half: true },
  { name: 'lastName', label: 'Last name', required: true, half: true },
  { name: 'employeeId', label: 'Employee ID', required: true, half: true, placeholder: 'EMP-1007' },
  { name: 'role', label: 'Role', type: 'select', options: opt(STAFF_ROLE), required: true, half: true },
  { name: 'department', label: 'Department', half: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, half: true },
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
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add staff'}
      initial={
        editing
          ? {
              firstName: staff.firstName, lastName: staff.lastName, employeeId: staff.employeeId,
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
