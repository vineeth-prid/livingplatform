import { describe, expect, it } from 'vitest';

import { contractHealth, formatMoney } from './config';

const now = new Date('2026-07-22T00:00:00Z');
const plusDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('formatMoney', () => {
  it('formats a decimal string with currency (Indian grouping)', () => {
    expect(formatMoney('120000', 'INR')).toBe('INR 1,20,000');
    expect(formatMoney('1500.5', 'USD')).toBe('USD 1,500.5');
  });
  it('handles missing values', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('')).toBe('—');
  });
});

describe('contractHealth', () => {
  it('maps explicit statuses', () => {
    expect(contractHealth('DRAFT', plusDays(100), now)).toBe('draft');
    expect(contractHealth('TERMINATED', plusDays(100), now)).toBe('terminated');
    expect(contractHealth('RENEWAL_PENDING', plusDays(10), now)).toBe('renewal');
    expect(contractHealth('EXPIRED', plusDays(-1), now)).toBe('expired');
  });
  it('derives expiring/active/expired from the end date when ACTIVE', () => {
    expect(contractHealth('ACTIVE', plusDays(10), now)).toBe('expiring');
    expect(contractHealth('ACTIVE', plusDays(120), now)).toBe('active');
    expect(contractHealth('ACTIVE', plusDays(-1), now)).toBe('expired');
  });
});
