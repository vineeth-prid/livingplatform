import type { PaymentReceipt } from '@living/living-sdk';

import { printDocument, type PrintableDocument } from './print-document';

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/** A payment receipt (maintenance, service or package) as a printable document. */
export function paymentReceiptDocument(r: PaymentReceipt): PrintableDocument {
  const { payment: p, community: c, invoice, resident, serviceRequest: sr } = r;
  const unit = invoice?.unit?.unitNumber ?? sr?.unit?.unitNumber;
  const name = [resident?.firstName, resident?.lastName].filter(Boolean).join(' ');
  const refunded = p.refundAmount ?? 0;
  return {
    title: 'Payment receipt',
    number: p.receiptNumber,
    status: refunded > 0 ? (refunded >= p.amount ? 'Refunded' : 'Partly refunded') : 'Paid',
    issuer: {
      name: c?.name ?? 'Living',
      logoUrl: c?.logoUrl,
      address: [c?.addressLine1, c?.addressLine2, c?.city, [c?.state, c?.pincode].filter(Boolean).join(' ')],
      contact: [c?.contactPhone, c?.contactEmail, c?.website],
    },
    party: { label: 'Received from', lines: [name, unit ? `Unit ${unit}` : null, resident?.mobile] },
    meta: [
      ['Payment date', p.paidAt ? new Date(p.paidAt).toLocaleString('en-IN') : null],
      ['Invoice', invoice?.invoiceNumber],
      ['Period', invoice ? `${date(invoice.periodStart)} – ${date(invoice.periodEnd)}` : null],
      ['Service request', sr?.displayNumber],
      ['Payment method', p.method ? p.method.toUpperCase() : p.gateway],
      ['Transaction ref.', p.gatewayPaymentId],
    ],
    lines: r.lines.length ? r.lines : [{ label: 'Payment', amount: p.amount }],
    totals: [
      ...(refunded > 0 ? [{ label: 'Refunded', amount: -refunded }] : []),
      { label: 'Amount paid', amount: p.amount, emphasis: true },
    ],
    currency: p.currency,
    footer: 'This is a computer-generated receipt and does not need a signature.',
  };
}

export function printPaymentReceipt(r: PaymentReceipt): boolean {
  return printDocument(paymentReceiptDocument(r));
}
