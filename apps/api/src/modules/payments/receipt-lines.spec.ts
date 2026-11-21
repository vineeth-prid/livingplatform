import { Prisma } from '@prisma/client';

import { receiptLines } from './receipt-lines';

const D = (v: number) => new Prisma.Decimal(v);

describe('receiptLines', () => {
  it('itemises a per-sq-ft maintenance invoice with late fee and discount, from stored values', () => {
    const lines = receiptLines(
      { baseAmount: D(5330), billedAreaSqft: D(1640), ratePerSqft: D(3.25), lateFee: D(100), adjustment: D(-50), cycle: 'MONTHLY' },
      null, null, 5380,
    );
    expect(lines).toEqual([
      { label: 'Maintenance charge', detail: '1,640 sq ft × ₹3.25', amount: 5330 },
      { label: 'Late fee', amount: 100 },
      { label: 'Discount / adjustment', amount: -50 },
    ]);
  });

  it('shows quantity × unit price for a multi-quantity service request', () => {
    const [line] = receiptLines(null, { title: 'Car wash', quantity: 3, unitPrice: D(350), totalPrice: D(1050), variant: { name: 'SUV' } }, null, 1050);
    expect(line).toEqual({ label: 'Car wash — SUV', detail: '3 × ₹350', amount: 1050 });
  });

  it('lists a package purchase from its frozen snapshot', () => {
    const [line] = receiptLines(null, null, {
      snapshot: { name: 'Quarterly Home Care', items: [{ serviceName: 'AC service', quantity: 2 }, { serviceName: 'Pest control', quantity: 1 }] },
      amount: D(5999),
    }, 5999);
    expect(line).toEqual({ label: 'Service package — Quarterly Home Care', detail: '2× AC service, 1× Pest control', amount: 5999 });
  });

  it('falls back to a single line equal to the payment', () => {
    expect(receiptLines(null, null, null, 499)).toEqual([{ label: 'Payment', amount: 499 }]);
  });
});
