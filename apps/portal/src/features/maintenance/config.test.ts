import { describe, expect, it } from 'vitest';

import { dueState, frequencyLabel } from './config';

const now = new Date('2026-07-22T00:00:00Z');
const plusDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('frequencyLabel', () => {
  it('handles fixed frequencies with intervals', () => {
    expect(frequencyLabel('MONTHLY')).toBe('Every month');
    expect(frequencyLabel('WEEKLY', 2)).toBe('Every 2 weeks');
    expect(frequencyLabel('QUARTERLY', 1)).toBe('Every quarter');
  });
  it('describes CUSTOM via its cron', () => {
    expect(frequencyLabel('CUSTOM', 1, '0 6 1 * *')).toBe('Custom · 0 6 1 * *');
    expect(frequencyLabel('CUSTOM')).toBe('Custom');
  });
});

describe('dueState', () => {
  it('is paused when inactive', () => {
    expect(dueState(plusDays(3), false, now)).toBe('paused');
  });
  it('flags overdue and soon windows', () => {
    expect(dueState(plusDays(-1), true, now)).toBe('overdue');
    expect(dueState(plusDays(3), true, now)).toBe('soon');
    expect(dueState(plusDays(30), true, now)).toBe('scheduled');
  });
});
