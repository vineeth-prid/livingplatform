import type { VendorPayoutDetail } from '@living/living-sdk';

import { money, printDocument, type PrintableDocument } from './print-document';

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;
const period = (p: VendorPayoutDetail) =>
  `${day(p.periodStart)} – ${day(p.periodEnd)} (${p.frequency === 'WEEKLY' ? 'weekly' : 'monthly'})`;
const terms = (l: VendorPayoutDetail['lines'][number]) =>
  l.commissionModel === 'PERCENTAGE' ? `${l.commissionRate}% commission`
    : l.commissionModel === 'FIXED' ? 'fixed commission' : 'no commission';

function issuer(p: VendorPayoutDetail): PrintableDocument['issuer'] {
  const c = p.community;
  return {
    name: c.name,
    logoUrl: c.logoUrl,
    address: [c.addressLine1, c.city, [c.state, c.pincode].filter(Boolean).join(' ')],
    contact: [c.contactPhone, c.contactEmail],
  };
}
const party = (p: VendorPayoutDetail) => ({
  label: 'Vendor',
  lines: [p.vendor.companyName || p.vendor.name, p.vendor.companyName ? p.vendor.name : null, p.vendor.phone, p.vendor.email],
});

export type VendorDocumentKind = 'statement' | 'receipt' | 'commission';

/**
 * The three system-generated vendor documents, kept distinct on purpose:
 *  • Payout statement — every eligible transaction in the period and its deductions;
 *  • Payment receipt  — evidence of a completed payout (PAID only);
 *  • Commission statement — what the community retained, line by line.
 * (A vendor *invoice* is the vendor's own document — uploaded, not generated.)
 */
export function vendorDocument(p: VendorPayoutDetail, kind: VendorDocumentKind): PrintableDocument {
  const common = { issuer: issuer(p), party: party(p), currency: 'INR' };
  if (kind === 'receipt') {
    if (p.status !== 'PAID') throw new Error('A payment receipt exists only for a paid payout');
    return {
      ...common,
      title: 'Vendor payment receipt',
      number: p.number,
      status: 'Paid',
      meta: [
        ['Payment date', day(p.paidAt)],
        ['Payout period', period(p)],
        ['Payment method', p.paymentMethod],
        ['Transaction ref.', p.paymentReference],
        ['Vendor invoice', p.vendorInvoiceNumber],
        ['Confirmed by', p.paidByName],
      ],
      lines: [{ label: `Payout for ${period(p)}`, detail: `${p.lines.length} completed service${p.lines.length === 1 ? '' : 's'} · statement ${p.number}`, amount: p.paidAmount ?? p.payable }],
      totals: [{ label: 'Amount paid', amount: p.paidAmount ?? p.payable, emphasis: true }],
      footer: 'Evidence of payment for the payout statement referenced above.',
    };
  }
  if (kind === 'commission') {
    return {
      ...common,
      title: 'Commission statement',
      number: p.number,
      status: p.status === 'PAID' ? 'Settled' : p.status === 'CANCELLED' ? 'Cancelled' : 'Pending',
      meta: [['Period', period(p)], ['Services', String(p.lines.length)]],
      lines: p.lines.map((l) => ({
        label: `${l.displayNumber} · ${l.serviceName}`,
        detail: `${day(l.completedAt)} · ${money(l.serviceValue)} service value · ${terms(l)}`,
        amount: l.commission,
      })),
      totals: [
        { label: 'Total service value', amount: p.serviceValue },
        { label: 'Commission retained by the community', amount: p.commission, emphasis: true },
      ],
      footer: 'Commission is deducted per completed service under the terms in force on its completion date.',
    };
  }
  return {
    ...common,
    title: 'Vendor payout statement',
    number: p.number,
    status: p.status === 'PAID' ? 'Paid' : p.status === 'CANCELLED' ? 'Cancelled' : 'Pending payment',
    meta: [
      ['Period', period(p)],
      ['Generated', day(p.createdAt)],
      ['Vendor invoice', p.vendorInvoiceNumber],
      ['Paid on', p.status === 'PAID' ? day(p.paidAt) : null],
      ['Payment ref.', p.paymentReference],
    ],
    lines: p.lines.map((l) => ({
      label: `${l.displayNumber} · ${l.title}`,
      detail: [
        day(l.completedAt),
        l.unitNumber ? `Unit ${l.unitNumber}` : null,
        `${money(l.serviceValue)}${l.basis === 'PACKAGE' ? ' (package, catalogue price)' : ''}`,
        `− ${money(l.commission)} ${terms(l)}`,
      ].filter(Boolean).join(' · '),
      amount: l.payable,
    })),
    totals: [
      { label: 'Total service value', amount: p.serviceValue },
      { label: 'Commission deducted', amount: -p.commission },
      { label: 'Net payable to vendor', amount: p.payable, emphasis: true },
    ],
    footer: 'Amounts are per completed service: what the resident paid less refunds, or the catalogue price for package visits.',
  };
}

export function printVendorDocument(p: VendorPayoutDetail, kind: VendorDocumentKind): boolean {
  return printDocument(vendorDocument(p, kind));
}
