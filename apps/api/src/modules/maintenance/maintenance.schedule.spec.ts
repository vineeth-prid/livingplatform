import { BadRequestException } from '@nestjs/common';
import { MaintenanceFrequency as F } from '@prisma/client';

import {
  addMonths, advanceNextRun, assertValidCron, computeInitialNextRun, nextRunFrom,
} from './maintenance.schedule';

const spec = (frequencyType: F, frequencyInterval = 1, cronExpression: string | null = null) =>
  ({ frequencyType, frequencyInterval, cronExpression });
const d = (s: string) => new Date(s);

describe('addMonths', () => {
  it('clamps to the last day of a shorter month', () => {
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).getUTCMonth()).toBe(1); // February
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).getUTCDate()).toBeLessThanOrEqual(29);
  });
  it('adds plain months otherwise', () => {
    expect(addMonths(d('2026-03-15T00:00:00Z'), 3).getUTCMonth()).toBe(5); // June
  });
});

describe('nextRunFrom', () => {
  const from = d('2026-07-22T09:00:00Z');
  it('handles each fixed frequency with its interval', () => {
    expect(nextRunFrom(from, spec(F.DAILY)).toISOString()).toBe('2026-07-23T09:00:00.000Z');
    expect(nextRunFrom(from, spec(F.WEEKLY)).toISOString()).toBe('2026-07-29T09:00:00.000Z');
    expect(nextRunFrom(from, spec(F.DAILY, 3)).toISOString()).toBe('2026-07-25T09:00:00.000Z');
    expect(nextRunFrom(from, spec(F.MONTHLY)).toISOString()).toBe('2026-08-22T09:00:00.000Z');
    expect(nextRunFrom(from, spec(F.QUARTERLY)).getUTCMonth()).toBe(9); // October
    expect(nextRunFrom(from, spec(F.HALF_YEARLY)).getUTCFullYear()).toBe(2027);
    expect(nextRunFrom(from, spec(F.YEARLY)).toISOString()).toBe('2027-07-22T09:00:00.000Z');
  });

  it('uses the cron expression for CUSTOM', () => {
    const next = nextRunFrom(from, spec(F.CUSTOM, 1, '0 6 1 * *')); // 6am on the 1st (server-local)
    expect(next.getDate()).toBe(1);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('rejects a CUSTOM plan with no cron', () => {
    expect(() => nextRunFrom(from, spec(F.CUSTOM))).toThrow(BadRequestException);
  });
});

describe('advanceNextRun', () => {
  it('rolls a long-overdue plan forward to a single future slot (no backlog)', () => {
    const consumed = d('2026-01-01T00:00:00Z');
    const now = d('2026-07-22T00:00:00Z');
    const next = advanceNextRun(consumed, spec(F.MONTHLY), now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    // The very next monthly slot after "now", not January+1.
    expect(next.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns the immediate next slot when not overdue', () => {
    const consumed = d('2026-07-22T00:00:00Z');
    const now = d('2026-07-22T00:30:00Z');
    expect(advanceNextRun(consumed, spec(F.DAILY), now).toISOString()).toBe('2026-07-23T00:00:00.000Z');
  });
});

describe('computeInitialNextRun', () => {
  it('is the start date for a fixed-frequency plan', () => {
    const start = d('2026-08-01T09:00:00Z');
    expect(computeInitialNextRun(spec(F.MONTHLY), start).toISOString()).toBe(start.toISOString());
  });
  it('is the first cron slot for a CUSTOM plan', () => {
    const start = d('2026-08-01T00:00:00Z');
    const next = computeInitialNextRun(spec(F.CUSTOM, 1, '0 12 15 * *'), start); // noon on the 15th (server-local)
    expect(next.getDate()).toBe(15);
  });
});

describe('assertValidCron', () => {
  it('accepts a valid expression', () => {
    expect(() => assertValidCron('0 9 * * 1')).not.toThrow();
  });
  it('rejects garbage', () => {
    expect(() => assertValidCron('not a cron')).toThrow(BadRequestException);
    expect(() => assertValidCron('99 99 99 99 99')).toThrow(BadRequestException);
  });
});
