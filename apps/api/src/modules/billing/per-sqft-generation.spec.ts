import { BillingCycle, ChargeCalculationMethod, Prisma } from '@prisma/client';

import { InvoiceService } from './invoice.service';

/**
 * Invoice generation with both rate kinds in one community: fixed units bill
 * exactly as before, per-sq-ft units bill area × rate with the area and rate
 * frozen on the invoice, and a per-sq-ft unit with no area is named and skipped.
 */
describe('InvoiceService.generate — fixed and per-sq-ft side by side', () => {
  const from = new Date('2026-01-01T00:00:00Z');
  const charges = [
    { id: 'fixed-2bhk', propertyType: '2BHK', calculationMethod: ChargeCalculationMethod.FIXED, ratePerSqft: null,
      monthlyAmount: new Prisma.Decimal(3200), quarterlyAmount: null, yearlyAmount: null, effectiveFrom: from, effectiveTo: null },
    { id: 'sqft-all', propertyType: 'ALL', calculationMethod: ChargeCalculationMethod.PER_SQFT, ratePerSqft: new Prisma.Decimal(3),
      monthlyAmount: new Prisma.Decimal(0), quarterlyAmount: null, yearlyAmount: null, effectiveFrom: from, effectiveTo: null },
  ];
  const units = [
    { id: 'u-fixed', unitNumber: 'A-101', type: '2BHK', builtUpArea: new Prisma.Decimal(1100), areaUnit: 'sqft', residentUnits: [] },
    { id: 'u-1000', unitNumber: 'B-101', type: '3BHK', builtUpArea: new Prisma.Decimal(1000), areaUnit: 'sqft', residentUnits: [] },
    { id: 'u-1250', unitNumber: 'B-102', type: '3BHK', builtUpArea: new Prisma.Decimal(1250), areaUnit: 'sqft', residentUnits: [] },
    { id: 'u-none', unitNumber: 'B-103', type: '3BHK', builtUpArea: null, areaUnit: 'sqft', residentUnits: [] },
  ];

  function build() {
    const prisma = {
      unit: { findMany: jest.fn().mockResolvedValue(units) },
      maintenanceCharge: { findMany: jest.fn().mockResolvedValue(charges) },
      maintenanceInvoice: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), createMany: jest.fn() },
    };
    const svc = new InvoiceService(
      prisma as never,
      { assert: jest.fn().mockResolvedValue({ tenantId: 't-1' }) } as never,
      { publish: jest.fn(), from: jest.fn() } as never,
      { get: () => ({ invoicePrefix: 'INV', defaultDueDay: 10, currency: 'INR' }) } as never,
      { billableResidentFor: jest.fn().mockResolvedValue('owner-1') } as never,
    );
    return { svc, prisma };
  }

  it('bills each unit by its own method and skips the unit with no area', async () => {
    const { svc, prisma } = build();
    const result = await svc.generate('c1', { cycle: BillingCycle.MONTHLY, periodDate: '2026-11-15' }, { id: 'admin' } as never);

    const rows = prisma.maintenanceInvoice.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    const byUnit = Object.fromEntries(rows.map((r) => [r.unitId, r]));
    expect(byUnit['u-fixed']).toMatchObject({ chargeId: 'fixed-2bhk', baseAmount: 3200, billedAreaSqft: null, ratePerSqft: null });
    expect(byUnit['u-1000']).toMatchObject({ chargeId: 'sqft-all', baseAmount: 3000 });
    expect(byUnit['u-1250']).toMatchObject({ baseAmount: 3750 });
    expect(Number(byUnit['u-1250']!.billedAreaSqft)).toBe(1250);
    expect(Number(byUnit['u-1250']!.ratePerSqft)).toBe(3);
    expect(byUnit['u-none']).toBeUndefined();

    expect(result).toMatchObject({ created: 3, unpriced: 1, missingArea: ['B-103'], totalBilled: 9950 });
  });
});
