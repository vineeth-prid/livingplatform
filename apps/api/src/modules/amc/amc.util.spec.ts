import { BadRequestException } from '@nestjs/common';

import { assertContractDates, assertSlaConsistent, isExpired, isRenewalDue } from './amc.util';

const d = (s: string) => new Date(s);
const days = (n: number) => n * 24 * 60 * 60 * 1000;

describe('assertContractDates', () => {
  it('accepts a positive term', () => {
    expect(() => assertContractDates(d('2026-01-01'), d('2027-01-01'))).not.toThrow();
  });
  it('rejects an end on/before the start', () => {
    expect(() => assertContractDates(d('2026-01-01'), d('2026-01-01'))).toThrow(BadRequestException);
    expect(() => assertContractDates(d('2027-01-01'), d('2026-01-01'))).toThrow(BadRequestException);
  });
});

describe('assertSlaConsistent', () => {
  it('accepts response ≤ resolution with valid escalation', () => {
    expect(() =>
      assertSlaConsistent({ responseTimeMinutes: 60, resolutionTimeMinutes: 240, escalationAfterMinutes: 120 }),
    ).not.toThrow();
  });
  it('rejects non-positive targets', () => {
    expect(() => assertSlaConsistent({ responseTimeMinutes: 0, resolutionTimeMinutes: 60 })).toThrow(BadRequestException);
  });
  it('rejects resolution shorter than response', () => {
    expect(() => assertSlaConsistent({ responseTimeMinutes: 240, resolutionTimeMinutes: 60 })).toThrow(BadRequestException);
  });
  it('rejects escalation earlier than response', () => {
    expect(() =>
      assertSlaConsistent({ responseTimeMinutes: 60, resolutionTimeMinutes: 240, escalationAfterMinutes: 30 }),
    ).toThrow(BadRequestException);
  });
});

describe('isExpired', () => {
  const now = d('2026-07-22T00:00:00Z');
  it('is true for an active contract past its end date', () => {
    expect(isExpired({ status: 'ACTIVE', endDate: d('2026-07-21T00:00:00Z') }, now)).toBe(true);
  });
  it('is false when still within term, or not active', () => {
    expect(isExpired({ status: 'ACTIVE', endDate: d('2026-08-01T00:00:00Z') }, now)).toBe(false);
    expect(isExpired({ status: 'DRAFT', endDate: d('2026-07-21T00:00:00Z') }, now)).toBe(false);
    expect(isExpired({ status: 'EXPIRED', endDate: d('2026-07-21T00:00:00Z') }, now)).toBe(false);
  });
});

describe('isRenewalDue', () => {
  const now = d('2026-07-22T00:00:00Z');
  it('is true inside the reminder window', () => {
    expect(isRenewalDue({ status: 'ACTIVE', endDate: new Date(now.getTime() + days(20)), renewalReminderDays: 30 }, now)).toBe(true);
  });
  it('is false outside the window or after expiry', () => {
    expect(isRenewalDue({ status: 'ACTIVE', endDate: new Date(now.getTime() + days(60)), renewalReminderDays: 30 }, now)).toBe(false);
    expect(isRenewalDue({ status: 'ACTIVE', endDate: new Date(now.getTime() - days(1)), renewalReminderDays: 30 }, now)).toBe(false);
    expect(isRenewalDue({ status: 'DRAFT', endDate: new Date(now.getTime() + days(10)), renewalReminderDays: 30 }, now)).toBe(false);
  });
});
