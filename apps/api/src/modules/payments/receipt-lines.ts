import type { Prisma } from '@prisma/client';

type Dec = Prisma.Decimal | number | null | undefined;
export interface ReceiptLine {
  label: string;
  detail?: string;
  amount: number;
}

const num = (v: Dec) => (v == null ? null : Number(v));

/**
 * The itemised lines printed on a receipt — a straight presentation of the
 * amounts already stored on the invoice / service request / package purchase.
 * Nothing is recalculated: the receipt total is always the payment's own
 * amount, and these lines only explain it.
 */
export function receiptLines(
  invoice: { baseAmount: Dec; billedAreaSqft: Dec; ratePerSqft: Dec; lateFee: Dec; adjustment: Dec; cycle?: string } | null,
  request: { title: string; quantity: number; unitPrice: Dec; totalPrice: Dec; variant: { name: string } | null } | null,
  purchase: { snapshot: Prisma.JsonValue; amount: Dec } | null,
  paymentAmount: number,
): ReceiptLine[] {
  if (invoice) {
    const area = num(invoice.billedAreaSqft);
    const rate = num(invoice.ratePerSqft);
    const lines: ReceiptLine[] = [
      {
        label: 'Maintenance charge',
        detail: area && rate ? `${area.toLocaleString('en-IN')} sq ft × ₹${rate}` : invoice.cycle?.toLowerCase(),
        amount: num(invoice.baseAmount) ?? paymentAmount,
      },
    ];
    const late = num(invoice.lateFee) ?? 0;
    const adj = num(invoice.adjustment) ?? 0;
    if (late) lines.push({ label: 'Late fee', amount: late });
    if (adj) lines.push({ label: adj < 0 ? 'Discount / adjustment' : 'Adjustment', amount: adj });
    return lines;
  }
  if (request) {
    const unit = num(request.unitPrice);
    return [
      {
        label: request.variant ? `${request.title} — ${request.variant.name}` : request.title,
        detail: unit != null && request.quantity > 1 ? `${request.quantity} × ₹${unit.toLocaleString('en-IN')}` : undefined,
        amount: num(request.totalPrice) ?? paymentAmount,
      },
    ];
  }
  if (purchase) {
    const snap = (purchase.snapshot ?? {}) as { name?: string; items?: { serviceName?: string; quantity?: number }[] };
    return [
      {
        label: snap.name ? `Service package — ${snap.name}` : 'Service package',
        detail: snap.items?.map((i) => `${i.quantity ?? 1}× ${i.serviceName ?? 'service'}`).join(', ') || undefined,
        amount: num(purchase.amount) ?? paymentAmount,
      },
    ];
  }
  return [{ label: 'Payment', amount: paymentAmount }];
}
