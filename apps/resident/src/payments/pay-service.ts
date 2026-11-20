import { living } from '../lib/living';
import { openCheckout } from './razorpay';

/**
 * Pay for a booked service request. The server prices it from the booking and
 * assigns a vendor once the payment settles; this only drives the checkout.
 * Resolves false when the resident closed the sheet without paying.
 */
export async function payForServiceRequest(
  communityId: string,
  serviceRequestId: string,
  communityName?: string,
): Promise<boolean> {
  const session = await living.payments.checkout(communityId, { purpose: 'SERVICE', serviceRequestId });
  const result = await openCheckout(session, { communityName });
  if (result.status === 'dismissed') return false;
  if (result.status === 'failed') throw new Error(result.reason ?? 'Payment failed');
  await living.payments.verify(communityId, {
    razorpayOrderId: result.handshake!.razorpay_order_id,
    razorpayPaymentId: result.handshake!.razorpay_payment_id,
    razorpaySignature: result.handshake!.razorpay_signature,
  });
  return true;
}
