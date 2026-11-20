import { dayRange, monthBounds, periodBounds, todayIn } from './expense-dates';

describe('expense dates — community timezone and month boundaries', () => {
  // 31 Oct 2026, 20:00 UTC is 1 Nov 01:30 in India: "this month" is November there.
  const lateOctUtc = new Date('2026-10-31T20:00:00Z');

  it('decides "today" in the community timezone, not UTC', () => {
    expect(todayIn('Asia/Kolkata', lateOctUtc)).toBe('2026-11-01');
    expect(todayIn('UTC', lateOctUtc)).toBe('2026-10-31');
  });

  it('current / previous month / year follow that timezone', () => {
    expect(periodBounds('current-month', 'Asia/Kolkata', lateOctUtc)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodBounds('previous-month', 'Asia/Kolkata', lateOctUtc)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodBounds('current-year', 'Asia/Kolkata', lateOctUtc)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('handles February, leap years and the year boundary', () => {
    expect(monthBounds('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2027-02-10')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(monthBounds('2027-01-15', -1)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('an inclusive day range covers the whole last day', () => {
    const r = dayRange('2026-11-01', '2026-11-30')!;
    expect(r.gte!.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(r.lt!.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(dayRange()).toBeUndefined();
  });
});
