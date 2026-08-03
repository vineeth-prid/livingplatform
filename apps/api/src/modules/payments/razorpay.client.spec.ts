import { createHmac } from 'node:crypto';

import { RazorpayClient } from './razorpay.client';

const KEY_SECRET = 'rzp_test_secret_value';
const WEBHOOK_SECRET = 'whsec_community_specific';

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('RazorpayClient.toMinorUnits', () => {
  it('converts rupees to paise', () => {
    expect(RazorpayClient.toMinorUnits(3000)).toBe(300000);
    expect(RazorpayClient.toMinorUnits(1234.56)).toBe(123456);
  });

  it('rounds away float representation error', () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE-754.
    expect(RazorpayClient.toMinorUnits(19.99)).toBe(1999);
  });

  it('round-trips back to rupees', () => {
    expect(RazorpayClient.fromMinorUnits(RazorpayClient.toMinorUnits(1234.56))).toBe(1234.56);
  });
});

describe('verifyCheckoutSignature', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const valid = sign(`${orderId}|${paymentId}`, KEY_SECRET);

  it('accepts a signature minted with the community key secret', () => {
    expect(
      RazorpayClient.verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: valid,
        keySecret: KEY_SECRET,
      }),
    ).toBe(true);
  });

  it('rejects a signature from a DIFFERENT community key (rail isolation)', () => {
    const otherCommunity = sign(`${orderId}|${paymentId}`, 'another_communitys_secret');
    expect(
      RazorpayClient.verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: otherCommunity,
        keySecret: KEY_SECRET,
      }),
    ).toBe(false);
  });

  it('rejects a replayed signature against a different payment', () => {
    expect(
      RazorpayClient.verifyCheckoutSignature({
        orderId,
        paymentId: 'pay_SOMETHINGELSE',
        signature: valid,
        keySecret: KEY_SECRET,
      }),
    ).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(
      RazorpayClient.verifyCheckoutSignature({ orderId, paymentId, signature: '', keySecret: KEY_SECRET }),
    ).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });

  it('accepts a signature over the exact raw body', () => {
    expect(RazorpayClient.verifyWebhookSignature(body, sign(body, WEBHOOK_SECRET), WEBHOOK_SECRET)).toBe(
      true,
    );
  });

  it('rejects when the body was altered after signing', () => {
    const signature = sign(body, WEBHOOK_SECRET);
    const tampered = body.replace('pay_1', 'pay_2');
    expect(RazorpayClient.verifyWebhookSignature(tampered, signature, WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    expect(
      RazorpayClient.verifyWebhookSignature(body, sign(body, 'wrong_secret'), WEBHOOK_SECRET),
    ).toBe(false);
  });

  it('is whitespace-sensitive (re-serializing the body breaks it)', () => {
    const signature = sign(body, WEBHOOK_SECRET);
    const reSerialized = JSON.stringify(JSON.parse(body), null, 2);
    expect(RazorpayClient.verifyWebhookSignature(reSerialized, signature, WEBHOOK_SECRET)).toBe(false);
  });
});
