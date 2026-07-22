import { useQueryClient } from '@tanstack/react-query';
import type { Resident } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { GENDER, opt, RESIDENT_STATUS } from '../master-data/options';

const fields: FieldDef[] = [
  { name: 'firstName', label: 'First name', required: true, half: true },
  { name: 'lastName', label: 'Last name', required: true, half: true },
  { name: 'residentCode', label: 'Resident code', required: true, half: true, placeholder: 'R-A101-01' },
  { name: 'mobile', label: 'Mobile', type: 'tel', required: true, half: true },
  { name: 'email', label: 'Email', type: 'email', half: true },
  { name: 'gender', label: 'Gender', type: 'select', options: opt(GENDER), half: true },
  { name: 'occupation', label: 'Occupation', half: true },
  { name: 'status', label: 'Status', type: 'select', options: opt(RESIDENT_STATUS), half: true },
  { name: 'emergencyContactName', label: 'Emergency contact', half: true },
  { name: 'emergencyContactPhone', label: 'Emergency phone', type: 'tel', half: true },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

/** Create / edit a resident. Edit passes `resident`; create passes none. */
export function ResidentForm({
  open, onOpenChange, communityId, resident, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  resident?: Resident;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!resident;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit resident' : 'Add resident'}
      description={editing ? undefined : 'Register a new resident for this community.'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add resident'}
      initial={
        editing
          ? {
              firstName: resident.firstName, lastName: resident.lastName,
              residentCode: resident.residentCode, mobile: resident.mobile,
              email: resident.email ?? '', gender: resident.gender ?? '',
              occupation: resident.occupation ?? '', status: resident.status,
              notes: (resident as { notes?: string }).notes ?? '',
            }
          : {}
      }
      onSubmit={async (values) => {
        const result = editing
          ? await living.people.updateResident(resident.id, values)
          : await living.people.createResident(communityId, values);
        await qc.invalidateQueries({ queryKey: ['residents'] });
        if (editing) await qc.invalidateQueries({ queryKey: ['resident', resident.id] });
        onSaved?.();
        return result;
      }}
    />
  );
}
