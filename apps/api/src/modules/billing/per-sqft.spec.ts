import { BillingCycle, Prisma } from '@prisma/client';

import { ALL_UNIT_TYPES, areaInSqft, chargeForUnit, perSqftAmount } from './billing.math';

describe('per-square-foot maintenance', () => {
  const area = (n: number) => areaInSqft(n)!;

  it('bills area × rate (₹3/sq ft on 1,000 / 1,250 / 1,500 sq ft)', () => {
    expect(perSqftAmount(area(1000), 3, BillingCycle.MONTHLY)).toBe(3000);
    expect(perSqftAmount(area(1250), 3, BillingCycle.MONTHLY)).toBe(3750);
    expect(perSqftAmount(area(1500), 3, BillingCycle.MONTHLY)).toBe(4500);
  });

  it('uses decimal arithmetic and rounds half-up once, at the end', () => {
    // 1,234.5 × 2.75 = 3,394.875 → 3,394.88
    expect(perSqftAmount(area(1234.5), 2.75, BillingCycle.MONTHLY)).toBe(3394.88);
    // Quarterly is exactly three months of the rate: 10,184.625 → 10,184.63
    expect(perSqftAmount(area(1234.5), 2.75, BillingCycle.QUARTERLY)).toBe(10184.63);
    expect(perSqftAmount(area(1000), 3, BillingCycle.YEARLY)).toBe(36000);
  });

  it('refuses to price a unit with no usable area', () => {
    expect(areaInSqft(null)).toBeNull();
    expect(areaInSqft(0)).toBeNull();
    expect(areaInSqft(-5)).toBeNull();
  });

  it('converts an area recorded in square metres', () => {
    expect(areaInSqft(100, 'sqm')!.toNumber()).toBe(1076.39);
    expect(areaInSqft(new Prisma.Decimal(950), 'sqft')!.toNumber()).toBe(950);
  });

  it('prefers the unit type rate, falling back to the all-types rate', () => {
    const from = new Date('2026-01-01');
    const own = { id: 'fixed-2bhk', propertyType: '2BHK', effectiveFrom: from };
    const all = { id: 'sqft-all', propertyType: ALL_UNIT_TYPES, effectiveFrom: from };
    const at = new Date('2026-11-01');
    expect(chargeForUnit([own, all], '2BHK', at)?.id).toBe('fixed-2bhk');
    expect(chargeForUnit([own, all], '3BHK', at)?.id).toBe('sqft-all');
    expect(chargeForUnit([own, all], null, at)?.id).toBe('sqft-all');
    // Without an all-types rate a unit with no own rate stays unpriced, as before.
    expect(chargeForUnit([own], '3BHK', at)).toBeNull();
  });
});
