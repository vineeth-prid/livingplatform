import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Download, Receipt, Wallet } from 'lucide-react';
import type { MaintenanceInvoice, Payment } from '@living/living-sdk';
import { useCommunityFeatures } from '@living/hooks';
import { Badge, Button, Card, Skeleton, toast } from '@living/ui';

import { useResidentCommunity } from '../community';
import { Section, SoftPlaceholder } from '../components';
import { living } from '../lib/living';
import { openCheckout } from '../payments/razorpay';
import { ScreenHeader } from '../shell';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PAID: 'success',
  ISSUED: 'info',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
};

/**
 * Feature 4, resident side: what I owe, what is next, everything I've paid, and
 * one tap to pay. The amount is never chosen on the client — the server derives
 * it from the invoice balance and mints the gateway order.
 */
export function MaintenanceScreen() {
  const { communityId, community } = useResidentCommunity();
  const features = useCommunityFeatures(communityId);
  const qc = useQueryClient();
  const [paying, setPaying] = useState<string | null>(null);

  // The community may not collect maintenance through Living at all. Gate the
  // queries too, not just the markup — otherwise this screen fires requests the
  // API deliberately 404s.
  const billingOn = features.maintenanceBilling;

  const dues = useQuery({
    queryKey: ['maintenance', 'my-dues', communityId],
    queryFn: () => living.billing.myDues(communityId!),
    enabled: !!communityId && billingOn,
  });
  const payments = useQuery({
    queryKey: ['maintenance', 'payments', communityId],
    queryFn: () => living.payments.list(communityId!, { limit: 25, sortBy: 'createdAt', sortDir: 'desc' }),
    enabled: !!communityId && billingOn,
  });

  const pay = useMutation({
    mutationFn: async (invoice: MaintenanceInvoice) => {
      const session = await living.payments.checkout(communityId!, {
        purpose: 'MAINTENANCE',
        invoiceId: invoice.id,
      });
      const result = await openCheckout(session, { communityName: community?.name });
      if (result.status === 'dismissed') return { settled: false as const };
      if (result.status === 'failed') throw new Error(result.reason ?? 'Payment failed');
      // The signature is verified server-side before anything is credited.
      await living.payments.verify(communityId!, {
        razorpayOrderId: result.handshake!.razorpay_order_id,
        razorpayPaymentId: result.handshake!.razorpay_payment_id,
        razorpaySignature: result.handshake!.razorpay_signature,
      });
      return { settled: true as const };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['maintenance'] });
      if (result.settled) toast.success('Payment successful — your receipt is ready');
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setPaying(null),
  });

  function onPay(invoice: MaintenanceInvoice) {
    setPaying(invoice.id);
    pay.mutate(invoice);
  }

  // Declared after every hook — an early return above them would change hook
  // order between renders as the feature flag resolves.
  if (!billingOn) {
    return (
      <div>
        <ScreenHeader title="Maintenance" subtitle="Your dues" />
        <div className="px-4">
          <SoftPlaceholder
            icon={Wallet}
            title="Not collected here"
            note="Your community collects maintenance charges outside Living."
          />
        </div>
      </div>
    );
  }

  const d = dues.data;

  return (
    <div>
      <ScreenHeader title="Maintenance" subtitle="Your dues" />
      <div className="px-4">
        {dues.isLoading ? (
          <Skeleton className="mb-6 h-32 rounded-card" />
        ) : !d || (d.outstanding === 0 && d.recent.length === 0) ? (
          <SoftPlaceholder
            icon={Wallet}
            title="Nothing due"
            note="Maintenance bills appear here once your community starts billing."
          />
        ) : (
          <>
            <Card variant="elevated" className="mb-6">
              <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                Total outstanding
              </p>
              <p
                className="mt-1 font-display text-h1 leading-none tracking-tight text-strong"
                data-numeric
              >
                {inr(d.outstanding)}
              </p>
              {d.overdueCount > 0 && (
                <p className="mt-2 text-sm text-danger-fg">
                  {d.overdueCount} {d.overdueCount === 1 ? 'bill is' : 'bills are'} overdue
                </p>
              )}
              {d.currentDue && (
                <Button
                  block
                  size="lg"
                  className="mt-4"
                  loading={paying === d.currentDue.id}
                  disabled={pay.isPending}
                  onClick={() => onPay(d.currentDue!)}
                >
                  Pay {inr(d.currentDue.balance)}
                </Button>
              )}
            </Card>

            {d.nextDue && (
              <Section title="Next due">
                <Card variant="elevated" className="flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-strong">
                      {d.nextDue.invoiceNumber}
                    </p>
                    <p className="text-xs text-subtle">
                      Due {new Date(d.nextDue.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-strong" data-numeric>
                    {inr(d.nextDue.balance)}
                  </span>
                </Card>
              </Section>
            )}

            <Section title="Invoices">
              <div className="flex flex-col gap-2">
                {d.recent.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    paying={paying === invoice.id}
                    disabled={pay.isPending}
                    onPay={() => onPay(invoice)}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        <Section title="Payment history">
          {payments.isLoading ? (
            <Skeleton className="h-16 rounded-card" />
          ) : (payments.data?.items ?? []).length === 0 ? (
            <SoftPlaceholder
              icon={Receipt}
              title="No payments yet"
              note="Every payment you make is listed here with its receipt."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {(payments.data?.items ?? []).map((payment) => (
                <PaymentRow key={payment.id} payment={payment} communityId={communityId!} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function InvoiceRow({
  invoice,
  paying,
  disabled,
  onPay,
}: {
  invoice: MaintenanceInvoice;
  paying: boolean;
  disabled: boolean;
  onPay: () => void;
}) {
  const payable = invoice.balance > 0 && invoice.status !== 'CANCELLED';
  return (
    <Card variant="elevated" className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-strong">{invoice.invoiceNumber}</p>
        <p className="text-xs text-subtle">
          {new Date(invoice.periodStart).toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric',
          })}{' '}
          · due {new Date(invoice.dueDate).toLocaleDateString()}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone={STATUS_TONE[invoice.status] ?? 'neutral'} size="sm" dot>
            {invoice.status.replace(/_/g, ' ').toLowerCase()}
          </Badge>
          {invoice.lateFee > 0 && (
            <span className="text-2xs text-warning-fg">+{inr(invoice.lateFee)} late fee</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-strong" data-numeric>
          {inr(payable ? invoice.balance : invoice.totalAmount)}
        </p>
        {payable ? (
          <Button size="sm" className="mt-1" loading={paying} disabled={disabled} onClick={onPay}>
            Pay
          </Button>
        ) : (
          <span className="mt-1 inline-flex items-center gap-1 text-2xs text-success-fg">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </span>
        )}
      </div>
    </Card>
  );
}

function PaymentRow({ payment, communityId }: { payment: Payment; communityId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const receipt = await living.payments.receipt(communityId, payment.id);
      // No PDF service on the platform — the receipt is data, and the browser's
      // own print dialog turns it into a PDF the resident can keep.
      printReceipt(receipt);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card variant="elevated" className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-strong">
          {payment.receiptNumber ?? payment.invoiceNumber ?? 'Payment'}
        </p>
        <p className="text-xs text-subtle">
          {new Date(payment.paidAt ?? payment.createdAt).toLocaleString()} ·{' '}
          {payment.method ?? payment.gateway}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-strong" data-numeric>
          {inr(payment.amount)}
        </p>
        {payment.status === 'PAID' ? (
          <Button size="sm" variant="ghost" className="mt-1" loading={downloading} onClick={download}>
            <Download className="h-3.5 w-3.5" /> Receipt
          </Button>
        ) : (
          <Badge tone={payment.status === 'FAILED' ? 'danger' : 'neutral'} size="sm">
            {payment.status.toLowerCase()}
          </Badge>
        )}
      </div>
    </Card>
  );
}

/** Render the receipt into a print window — the browser saves it as a PDF. */
function printReceipt(receipt: Record<string, unknown>): void {
  const payment = receipt.payment as Payment;
  const community = receipt.community as { name?: string; addressLine1?: string; city?: string } | null;
  const invoice = receipt.invoice as
    | { invoiceNumber?: string; periodStart?: string; periodEnd?: string; unit?: { unitNumber?: string } }
    | null;
  const resident = receipt.resident as { firstName?: string; lastName?: string; mobile?: string } | null;

  const win = window.open('', '_blank', 'width=480,height=720');
  if (!win) {
    toast.error('Allow pop-ups to download your receipt');
    return;
  }
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6b6b6b">${label}</td><td style="padding:6px 0;text-align:right;font-weight:600">${value}</td></tr>`;

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${payment.receiptNumber ?? ''}</title></head>
<body style="font-family:Georgia,serif;max-width:420px;margin:32px auto;color:#1c1c1c">
  <h1 style="margin:0;font-size:22px">${community?.name ?? 'Living'}</h1>
  <p style="margin:2px 0 20px;color:#6b6b6b;font-size:13px">${[community?.addressLine1, community?.city].filter(Boolean).join(', ')}</p>
  <h2 style="font-size:16px;border-bottom:1px solid #ddd;padding-bottom:8px">Payment receipt</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    ${row('Receipt no.', payment.receiptNumber ?? '—')}
    ${row('Date', new Date(payment.paidAt ?? payment.createdAt).toLocaleString())}
    ${resident ? row('Resident', `${resident.firstName ?? ''} ${resident.lastName ?? ''}`.trim()) : ''}
    ${invoice?.unit?.unitNumber ? row('Unit', invoice.unit.unitNumber) : ''}
    ${invoice?.invoiceNumber ? row('Invoice', invoice.invoiceNumber) : ''}
    ${invoice?.periodStart ? row('Period', `${new Date(invoice.periodStart).toLocaleDateString()} – ${new Date(invoice.periodEnd!).toLocaleDateString()}`) : ''}
    ${row('Method', payment.method ?? payment.gateway)}
    ${payment.gatewayPaymentId ? row('Reference', payment.gatewayPaymentId) : ''}
  </table>
  <p style="margin-top:24px;font-size:22px;text-align:right"><strong>${inr(payment.amount)}</strong></p>
  <p style="margin-top:32px;font-size:11px;color:#8a8a8a;text-align:center">Life Happens Here.</p>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
