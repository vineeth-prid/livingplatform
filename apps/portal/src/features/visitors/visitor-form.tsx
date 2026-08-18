import { FormDrawer, type FieldDef } from '../master-data';
import { useVisitorMutations } from './lib';

/**
 * Invite a visitor on a resident's behalf.
 *
 * The host is now chosen as a UNIT, not a resident. A gate entry is always for a
 * flat — that is what the guard checks and what the notification is addressed
 * against — and the resident to notify is resolved from the unit's primary
 * occupant. Picking a resident instead was how a visit could be recorded with no
 * flat attached, which is also why "invite by unit number" was impossible.
 */
export function VisitorForm({
  open, onOpenChange, communityId, units, visitor, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  communityId: string;
  units: { value: string; label: string }[];
  visitor?: {
    id: string;
    unitId: string;
    personName: string;
    mobileNumber: string | null;
    vehicleNumber: string | null;
    remarks: string | null;
    expectedArrival: string | null;
  };
  onSaved?: () => void;
}) {
  const { create, update } = useVisitorMutations(visitor?.id);
  const editing = !!visitor;
  const today = new Date().toISOString().slice(0, 10);

  const fields: FieldDef[] = [
    // Not offered when editing: moving a recorded arrival to another flat would
    // rewrite who was notified and who approved it.
    ...(editing
      ? []
      : [{ name: 'unitId', label: 'Visiting which unit', type: 'select', required: true, options: units, placeholder: 'Select a unit' } as FieldDef]),
    { name: 'personName', label: 'Visitor name', required: true, half: true },
    { name: 'mobileNumber', label: 'Mobile', type: 'tel', half: true },
    { name: 'vehicleNumber', label: 'Vehicle (optional)', half: true },
    { name: 'expectedArrival', label: 'Expected arrival', type: 'date', required: !editing, half: true, min: today },
    { name: 'remarks', label: 'Purpose', type: 'textarea' },
  ];

  const initial: Record<string, string> = visitor
    ? {
        personName: visitor.personName,
        mobileNumber: visitor.mobileNumber ?? '',
        vehicleNumber: visitor.vehicleNumber ?? '',
        remarks: visitor.remarks ?? '',
        expectedArrival: visitor.expectedArrival?.slice(0, 10) ?? '',
      }
    : {};

  async function onSubmit(values: Record<string, string>) {
    const body: Record<string, unknown> = { ...values };
    if (values.expectedArrival) body.expectedArrival = new Date(values.expectedArrival).toISOString();
    // Empty strings are "not provided", not "set it to blank".
    for (const k of ['mobileNumber', 'vehicleNumber', 'remarks']) {
      if (!body[k]) delete body[k];
    }
    const result = editing
      ? await update.mutateAsync(body)
      : await create.mutateAsync({ communityId, ...body });
    onSaved?.();
    return result;
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit visitor' : 'Invite visitor'}
      fields={fields}
      initial={initial}
      submitLabel={editing ? 'Save' : 'Invite'}
      onSubmit={onSubmit}
    />
  );
}
