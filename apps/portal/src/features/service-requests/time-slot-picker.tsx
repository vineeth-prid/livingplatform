import { Input } from '@living/ui';
import { cn } from '@living/utils';

/** 1-hour slots, 10:00 → 17:00. Label shown to the user; range stored in value. */
const SLOTS = [
  ['10:00', '11:00'], ['11:00', '12:00'], ['12:00', '13:00'], ['13:00', '14:00'],
  ['14:00', '15:00'], ['15:00', '16:00'], ['16:00', '17:00'],
] as const;

/** Value format: "YYYY-MM-DD HH:mm-HH:mm" (a date + one of the fixed slots). */
export function parseSlot(value?: string): { date: string; slot: string } {
  if (!value) return { date: '', slot: '' };
  const [date = '', slot = ''] = value.split(' ');
  return { date, slot };
}

export function TimeSlotPicker({
  label = 'Preferred slot', value, onChange,
}: {
  label?: string; value: string; onChange: (v: string) => void;
}) {
  const { date, slot } = parseSlot(value);
  const today = new Date().toISOString().slice(0, 10);

  const setDate = (d: string) => onChange(d ? `${d}${slot ? ` ${slot}` : ''}` : '');
  const setSlot = (s: string) => onChange(date ? `${date} ${s}` : '');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-strong">{label}</span>
      <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {SLOTS.map(([from, to]) => {
          const range = `${from}-${to}`;
          const active = slot === range;
          return (
            <button key={range} type="button" disabled={!date} onClick={() => setSlot(range)}
              className={cn(
                'rounded-control border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-40',
                active ? 'border-brand bg-brand text-white' : 'border-border bg-raised text-muted hover:text-strong',
              )}>
              {from}–{to}
            </button>
          );
        })}
      </div>
      {!date && <span className="text-xs text-subtle">Pick a date to choose a time slot.</span>}
    </div>
  );
}
