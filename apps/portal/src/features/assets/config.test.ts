import { describe, expect, it } from 'vitest';

import { warrantyState } from './config';

const now = new Date('2026-07-22T00:00:00Z');
const plusDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('warrantyState', () => {
  it('is "none" for a missing or invalid date', () => {
    expect(warrantyState(null, now)).toBe('none');
    expect(warrantyState(undefined, now)).toBe('none');
    expect(warrantyState('not-a-date', now)).toBe('none');
  });
  it('is "expired" for a past date', () => {
    expect(warrantyState(plusDays(-1), now)).toBe('expired');
  });
  it('is "expiring" within the soon window', () => {
    expect(warrantyState(plusDays(30), now)).toBe('expiring');
    expect(warrantyState(plusDays(60), now)).toBe('expiring');
  });
  it('is "valid" comfortably in the future', () => {
    expect(warrantyState(plusDays(120), now)).toBe('valid');
  });
});
