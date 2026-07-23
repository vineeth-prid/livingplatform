import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';
import type { Resident } from '@living/types';

import { living } from '../../lib/living';
import { SelectField, TextAreaField } from '../shared/form-kit';
import { opt, GENDER, RESIDENT_STATUS } from '../master-data/options';

const OCCUPIED_BY = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'TENANT', label: 'Tenant' },
];

type Values = {
  occupiedBy: string; unitId: string;
  firstName: string; lastName: string; mobile: string; email: string;
  gender: string; occupation: string; status: string;
  emergencyContactName: string; emergencyContactPhone: string; notes: string;
};

const EMPTY: Values = {
  occupiedBy: '', unitId: '', firstName: '', lastName: '', mobile: '', email: '',
  gender: '', occupation: '', status: '', emergencyContactName: '', emergencyContactPhone: '', notes: '',
};

/** Create / edit a resident. On create, occupancy + unit mapping are captured;
 *  picking "Owner" + a unit auto-fills the owner name & phone from the unit. */
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
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const units = useQuery({
    queryKey: [...qk.units(communityId, 'resident-form')],
    queryFn: () => living.community.listUnits(communityId, { limit: 500, sortBy: 'unitNumber', sortDir: 'asc' }),
    enabled: open && !editing,
  });

  const unitOptions = useMemo(
    () => (units.data?.items ?? []).map((u) => ({ value: u.id, label: u.unitNumber })),
    [units.data],
  );

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(editing
      ? {
          ...EMPTY,
          firstName: resident.firstName, lastName: resident.lastName, mobile: resident.mobile,
          email: resident.email ?? '', gender: resident.gender ?? '',
          occupation: resident.occupation ?? '', status: resident.status,
          occupiedBy: resident.unitAssignment?.role ?? '',
          unitId: resident.unitAssignment?.unitId ?? '',
          emergencyContactName: resident.emergencyContactName ?? '',
          emergencyContactPhone: resident.emergencyContactPhone ?? '',
          notes: (resident as { notes?: string }).notes ?? '',
        }
      : EMPTY);
  }, [open, editing, resident]);

  const set = (name: keyof Values, value: string) => setValues((v) => ({ ...v, [name]: value }));

  // Owner auto-populate: when Owner + a unit is chosen, prefill name & phone
  // from the unit's owner details (only if those fields are still empty).
  const applyOwnerFromUnit = (occupiedBy: string, unitId: string) => {
    if (occupiedBy !== 'OWNER' || !unitId) return;
    const unit = units.data?.items.find((u) => u.id === unitId);
    if (!unit?.ownerName && !unit?.ownerPhone) return;
    setValues((v) => {
      const [first, ...rest] = (unit.ownerName ?? '').trim().split(/\s+/);
      return {
        ...v,
        firstName: v.firstName || first || v.firstName,
        lastName: v.lastName || rest.join(' ') || v.lastName,
        mobile: v.mobile || unit.ownerPhone || v.mobile,
      };
    });
  };

  async function submit() {
    const e: Record<string, string> = {};
    if (!values.firstName.trim()) e.firstName = 'Required';
    if (!values.lastName.trim()) e.lastName = 'Required';
    if (!values.mobile.trim()) e.mobile = 'Required';
    if (!editing && !values.occupiedBy) e.occupiedBy = 'Required';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    try {
      if (editing) {
        await living.people.updateResident(resident.id, {
          firstName: values.firstName, lastName: values.lastName, mobile: values.mobile,
          email: values.email || undefined, gender: values.gender || undefined,
          occupation: values.occupation || undefined, status: values.status || undefined,
          emergencyContactName: values.emergencyContactName || undefined,
          emergencyContactPhone: values.emergencyContactPhone || undefined,
          notes: values.notes || undefined,
        });
      } else {
        await living.people.createResident(communityId, {
          firstName: values.firstName, lastName: values.lastName, mobile: values.mobile,
          email: values.email || undefined, gender: values.gender || undefined,
          occupation: values.occupation || undefined, status: values.status || undefined,
          occupiedBy: values.occupiedBy || undefined, unitId: values.unitId || undefined,
          emergencyContactName: values.emergencyContactName || undefined,
          emergencyContactPhone: values.emergencyContactPhone || undefined,
          notes: values.notes || undefined,
        });
      }
      await qc.invalidateQueries({ queryKey: ['residents'] });
      if (editing) await qc.invalidateQueries({ queryKey: ['resident', resident.id] });
      toast.success('Saved');
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not save');
    } finally {
      setSubmitting(false);
    }
  }

  const isOwner = values.occupiedBy === 'OWNER';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right"
        title={editing ? 'Edit resident' : 'Add resident'}
        description={editing ? undefined : 'A login is created — username is the mobile number, password Living@123 (changed on first sign-in). Resident code is auto-generated.'}
        className="w-[min(94vw,560px)]">
        <div className="flex flex-col gap-4">
          {editing && (
            <Input label="Resident code" value={resident.residentCode} readOnly disabled />
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!editing && (
              <>
                <SelectField label="Occupied By" required value={values.occupiedBy}
                  onChange={(v) => { set('occupiedBy', v); applyOwnerFromUnit(v, values.unitId); }}
                  options={OCCUPIED_BY} error={errors.occupiedBy} />
                <SelectField label="Unit" value={values.unitId}
                  onChange={(v) => { set('unitId', v); applyOwnerFromUnit(values.occupiedBy, v); }}
                  options={unitOptions} placeholder={units.isLoading ? 'Loading units…' : 'No unit'} />
              </>
            )}
            <Input label="First name" value={values.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} />
            <Input label="Last name" value={values.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} />
            <Input label="Mobile (login username)" type="tel" value={values.mobile} onChange={(e) => set('mobile', e.target.value)} error={errors.mobile} />
            <Input label="Email" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />
            <SelectField label="Gender" value={values.gender} onChange={(v) => set('gender', v)} options={opt(GENDER)} />
            <Input label="Occupation" value={values.occupation} onChange={(e) => set('occupation', e.target.value)} />
            <Input label="Emergency contact" value={values.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} />
            <Input label="Emergency phone" type="tel" value={values.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} />
            {editing && <SelectField label="Status" value={values.status} onChange={(v) => set('status', v)} options={opt(RESIDENT_STATUS)} />}
          </div>
          {isOwner && !editing && (
            <p className="text-xs text-subtle">Owner details auto-fill from the selected unit — edit if needed.</p>
          )}
          <TextAreaField label="Notes" value={values.notes} onChange={(v) => set('notes', v)} />
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} loading={submitting}>{editing ? 'Save changes' : 'Add resident'}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
