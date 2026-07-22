import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Button, Input, toast } from '@living/ui';
import type { ServiceRequest } from '@living/types';

import { Field, FieldGrid } from '../master-data';
import { useServiceRequestMutations } from './queries';

const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

/** Scheduling: preferred date/slot + actual start/end (no calendar engine). */
export function ServiceScheduling({ request, canEdit }: { request: ServiceRequest; canEdit: boolean }) {
  const { schedule } = useServiceRequestMutations(request.id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    preferredDate: toLocal(request.preferredDate),
    preferredTimeSlot: request.preferredTimeSlot ?? '',
    actualStart: toLocal(request.actualStart),
    actualEnd: toLocal(request.actualEnd),
  });

  async function save() {
    try {
      await schedule.mutateAsync({
        preferredDate: form.preferredDate ? new Date(form.preferredDate).toISOString() : undefined,
        preferredTimeSlot: form.preferredTimeSlot || undefined,
        actualStart: form.actualStart ? new Date(form.actualStart).toISOString() : undefined,
        actualEnd: form.actualEnd ? new Date(form.actualEnd).toISOString() : undefined,
      });
      toast.success('Schedule updated');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not update schedule');
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <FieldGrid cols={2}>
          <Field label="Preferred" value={request.preferredDate ? formatDateTime(request.preferredDate) : request.preferredTimeSlot} />
          <Field label="Time slot" value={request.preferredTimeSlot} />
          <Field label="Started" value={request.actualStart ? formatDateTime(request.actualStart) : null} />
          <Field label="Finished" value={request.actualEnd ? formatDateTime(request.actualEnd) : null} />
        </FieldGrid>
        {canEdit && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setEditing(true)}>
            <CalendarClock className="h-4 w-4" /> Edit schedule
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Preferred date" type="datetime-local" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
        <Input label="Time slot" value={form.preferredTimeSlot} onChange={(e) => setForm({ ...form, preferredTimeSlot: e.target.value })} placeholder="Morning (9–12)" />
        <Input label="Actual start" type="datetime-local" value={form.actualStart} onChange={(e) => setForm({ ...form, actualStart: e.target.value })} />
        <Input label="Actual end" type="datetime-local" value={form.actualEnd} onChange={(e) => setForm({ ...form, actualEnd: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" loading={schedule.isPending} onClick={save}>Save schedule</Button>
      </div>
    </div>
  );
}
