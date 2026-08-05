import { describe, expect, it } from 'vitest';

import { dueLabel } from './request-detail';

/** Days are counted from local midnight, so a due date later TODAY is still
 *  "due today" rather than rounding to "overdue" or "tomorrow". */
const atHour = (dayOffset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('dueLabel', () => {
  it('reads today as today, whatever the clock says', () => {
    expect(dueLabel(atHour(0, 1)).text).toBe('Due today');
    expect(dueLabel(atHour(0, 23)).text).toBe('Due today');
    expect(dueLabel(atHour(0, 12)).overdue).toBe(false);
  });

  it('names tomorrow rather than making the resident do the arithmetic', () => {
    expect(dueLabel(atHour(1, 9)).text).toBe('Due tomorrow');
  });

  it('flags overdue and singularises one day', () => {
    expect(dueLabel(atHour(-1, 9))).toEqual({ text: 'Overdue by 1 day', overdue: true });
    expect(dueLabel(atHour(-3, 9))).toEqual({ text: 'Overdue by 3 days', overdue: true });
  });

  it('falls back to a date further out', () => {
    const label = dueLabel(atHour(10, 9));
    expect(label.overdue).toBe(false);
    expect(label.text).toMatch(/^Due \d+ \w+$/);
  });
});
