import { createHmac } from 'node:crypto';

import { BadGatewayException, Logger } from '@nestjs/common';

import { safeEqual } from '../../common/crypto/secret-cipher';

/** Resolved credentials for one community + purpose. */
export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  receipt?: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number; // paise
  currency: string;
  status: string; // created | authorized | captured | refunded | failed
  method?: string;
  error_description?: string;
}

/**
 * A thin, dependency-free Razorpay REST client (global fetch + Basic auth).
 *
 * There is deliberately no `razorpay` npm package here: the platform needs four
 * calls, and every one of them is a single fetch. Credentials are passed in per
 * call because they are COMMUNITY-scoped — this client holds no state and no
 * secret, so one instance safely serves every tenant.
 */
export class RazorpayClient {
  private static readonly logger = new Logger(RazorpayClient.name);

  /** Rupees → paise, the only unit Razorpay accepts. */
  static toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }

  static fromMinorUnits(minor: number): number {
    return Math.round(minor) / 100;
  }

  async createOrder(
    creds: RazorpayCredentials,
    input: { amount: number; currency: string; receipt: string; notes?: Record<string, string> },
  ): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>(creds, 'POST', '/orders', {
      amount: RazorpayClient.toMinorUnits(input.amount),
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    });
  }

  async fetchPayment(creds: RazorpayCredentials, paymentId: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(creds, 'GET', `/payments/${encodeURIComponent(paymentId)}`);
  }

  async refund(
    creds: RazorpayCredentials,
    paymentId: string,
    amount?: number,
  ): Promise<{ id: string; amount: number; status: string }> {
    return this.request(creds, 'POST', `/payments/${encodeURIComponent(paymentId)}/refund`, {
      ...(amount !== undefined ? { amount: RazorpayClient.toMinorUnits(amount) } : {}),
    });
  }

  /** Liveness probe for the admin UI — cheap, authenticated, side-effect free. */
  async verify(creds: RazorpayCredentials): Promise<boolean> {
    try {
      await this.request(creds, 'GET', '/orders?count=1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checkout handshake signature: HMAC-SHA256(order_id|payment_id, key_secret).
   * Constant-time compared — a client-supplied signature is attacker-controlled.
   */
  static verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
    keySecret: string;
  }): boolean {
    const expected = createHmac('sha256', input.keySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return safeEqual(expected, input.signature);
  }

  /** Webhook signature: HMAC-SHA256(raw body, webhook_secret). */
  static verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  private async request<T>(
    creds: RazorpayCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${creds.baseUrl}${path}`;
    const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), creds.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!res.ok) {
        const error = parsed.error as { description?: string; code?: string } | undefined;
        // Never log the response wholesale — it echoes request notes back.
        RazorpayClient.logger.warn(
          `Razorpay ${method} ${path} failed: ${res.status} ${error?.code ?? ''}`,
        );
        throw new BadGatewayException(
          error?.description ?? `Payment gateway rejected the request (${res.status})`,
        );
      }
      return parsed as T;
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new BadGatewayException('Payment gateway timed out');
      }
      throw new BadGatewayException(`Payment gateway is unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
