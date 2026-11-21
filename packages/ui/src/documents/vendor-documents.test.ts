import { describe, expect, it } from 'vitest';
import type { VendorPayoutDetail } from '@living/living-sdk';

import { renderDocumentHtml } from './print-document';
import { vendorDocument } from './vendor-documents';

const line = (n: number, value: number, commission: number) => ({
  id: `l${n}`, serviceRequestId: `sr${n}`, displayNumber: `SRQ-00000${n}`, title: `Deep clean ${n}`, serviceName: 'Deep clean',
  unitNumber: 'A-101', completedAt: '2026-11-03T06:00:00.000Z', basis: 'PAID', serviceValue: value,
  commissionModel: 'PERCENTAGE' as const, commissionRate: 10, commission, payable: value - commission,
});

const payout: VendorPayoutDetail = {
  id: 'p1', communityId: 'c1', vendorId: 'v1', number: 'VPO-202611-000001', frequency: 'WEEKLY',
  periodStart: '2026-11-02T12:00:00.000Z', periodEnd: '2026-11-08T12:00:00.000Z',
  serviceValue: 15000, commission: 1500, payable: 13500, status: 'PENDING',
  paidAmount: null, paidAt: null, paymentReference: null, paymentMethod: null, notes: null, cancelledAt: null, cancelReason: null,
  vendorInvoiceNumber: null, vendorInvoiceKey: null, createdAt: '2026-11-09T05:00:00.000Z', paidByName: null,
  vendor: { id: 'v1', name: 'Ramesh', companyName: 'BrightSpark Electricals', phone: '6390050951', email: null, addressLine: null, city: null },
  community: { name: 'Skyline', logoUrl: 'https://cdn/logo.png' },
  lines: [line(1, 10000, 1000), line(2, 5000, 500)],
};

describe('vendor documents', () => {
  it('payout statement: one row per service, totals reconcile to the lines', () => {
    const doc = vendorDocument(payout, 'statement');
    expect(doc.title).toBe('Vendor payout statement');
    expect(doc.lines.map((l) => l.amount)).toEqual([9000, 4500]);
    expect(doc.lines.reduce((s, l) => s + l.amount, 0)).toBe(payout.payable);
    expect(doc.totals).toEqual([
      { label: 'Total service value', amount: 15000 },
      { label: 'Commission deducted', amount: -1500 },
      { label: 'Net payable to vendor', amount: 13500, emphasis: true },
    ]);
    expect(renderDocumentHtml(doc)).toContain('src="https://cdn/logo.png"');
  });

  it('commission statement sums to the commission retained', () => {
    const doc = vendorDocument(payout, 'commission');
    expect(doc.lines.reduce((s, l) => s + l.amount, 0)).toBe(1500);
  });

  it('a payment receipt exists only once the payout is paid, for the amount paid', () => {
    expect(() => vendorDocument(payout, 'receipt')).toThrow();
    const paid = vendorDocument({ ...payout, status: 'PAID', paidAmount: 13500, paidAt: '2026-11-10T12:00:00Z', paymentReference: 'UTR9' }, 'receipt');
    expect(paid.title).toBe('Vendor payment receipt');
    expect(paid.totals.at(-1)).toEqual({ label: 'Amount paid', amount: 13500, emphasis: true });
    expect(paid.meta).toContainEqual(['Transaction ref.', 'UTR9']);
  });
});
