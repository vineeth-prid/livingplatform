import { FormDrawer, type FieldDef } from '../master-data';
import { VISITOR_TYPE, useVisitorMutations } from './lib';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

/** Invite / edit a visitor. Managers may act for any resident. */
export function VisitorForm({
  open, onOpenChange, communityId, residents, visitor, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; communityId: string;
  residents: { value: string; label: string }[];
  visitor?: { id: string; residentId: string; visitorName: string; mobileNumber: string; vehicleNumber?: string | null; visitorType: string; purpose?: string | null; expectedArrival: string; notes?: string | null };
  onSaved?: () => void;
}) {
  const { create, update } = useVisitorMutations(visitor?.id);
  const editing = !!visitor;

  const fields: FieldDef[] = [
    { name: 'residentId', label: 'Host resident', type: 'select', required: !editing, options: residents, placeholder: 'Select a resident' },
    { name: 'visitorName', label: 'Visitor name', required: true, half: true },
    { name: 'mobileNumber', label: 'Mobile', type: 'tel', required: true, half: true },
    { name: 'visitorType', label: 'Type', type: 'select', options: VISITOR_TYPE.map((t) => ({ value: t, label: humanize(t) })), half: true },
    { name: 'vehicleNumber', label: 'Vehicle (optional)', half: true },
    { name: 'expectedArrival', label: 'Expected arrival', type: 'date', required: true, half: true },
    { name: 'purpose', label: 'Purpose', type: 'textarea' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const initial: Record<string, string> = visitor ? {
    residentId: visitor.residentId, visitorName: visitor.visitorName, mobileNumber: visitor.mobileNumber,
    vehicleNumber: visitor.vehicleNumber ?? '', visitorType: visitor.visitorType, purpose: visitor.purpose ?? '',
    expectedArrival: visitor.expectedArrival.slice(0, 10), notes: visitor.notes ?? '',
  } : {};

  async function onSubmit(values: Record<string, string>) {
    const body: Record<string, unknown> = { ...values };
    if (values.expectedArrival) body.expectedArrival = new Date(values.expectedArrival).toISOString();
    let result;
    if (editing) result = await update.mutateAsync(body);
    else result = await create.mutateAsync({ communityId, ...body });
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
