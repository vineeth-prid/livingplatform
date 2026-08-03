import type { CheckoutSession } from '@living/living-sdk';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: unknown) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/**
 * Load Razorpay Checkout on demand.
 *
 * The script is NOT bundled or precached: it is a third-party payment widget
 * that must always be the live version, and pulling it into the service worker
 * would mean shipping a stale checkout. One `<script>`, cached by the browser
 * after the first payment.
 */
export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () =>
        window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to load')),
      );
      existing.addEventListener('error', () => reject(new Error('Razorpay failed to load')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to load'));
    script.onerror = () =>
      reject(new Error('Could not reach the payment gateway. Check your connection.'));
    document.head.appendChild(script);
  });
}

export interface CheckoutResult {
  status: 'paid' | 'dismissed' | 'failed';
  handshake?: RazorpayHandlerResponse;
  reason?: string;
}

/**
 * Open the checkout for a server-created order and resolve with what happened.
 *
 * The handshake it returns is NOT proof of payment — it must be posted back to
 * the API, which verifies the signature against the community's own key secret.
 * The webhook settles the payment independently, so a user who closes the sheet
 * mid-payment still gets credited.
 */
export async function openCheckout(
  session: CheckoutSession,
  meta: { communityName?: string; themeColor?: string } = {},
): Promise<CheckoutResult> {
  const Razorpay = await loadRazorpay();

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = new Razorpay({
      key: session.keyId,
      amount: session.amountMinor,
      currency: session.currency,
      order_id: session.orderId,
      name: meta.communityName ?? 'Living',
      description: session.description,
      prefill: session.prefill,
      theme: { color: meta.themeColor ?? '#234b39' },
      handler: (response: RazorpayHandlerResponse) => finish({ status: 'paid', handshake: response }),
      modal: {
        ondismiss: () => finish({ status: 'dismissed' }),
      },
    });

    instance.on('payment.failed', (response) => {
      const error = (response as { error?: { description?: string } }).error;
      finish({ status: 'failed', reason: error?.description ?? 'The payment could not be completed' });
    });

    instance.open();
  });
}
