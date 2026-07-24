import { createHmac } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import { MetaWebhookService } from './meta-webhook.service';
import type { DeliveryTracker } from '../core/delivery-tracker';

const APP_SECRET = 'test-secret';
const VERIFY_TOKEN = 'verify-me';

function makeService(
  tracker?: Partial<DeliveryTracker>,
  opts: { verifyToken?: string; appSecret?: string; env?: string } = {},
) {
  const tracking = {
    markDelivered: jest.fn().mockResolvedValue(true),
    markRead: jest.fn().mockResolvedValue(true),
    markProviderFailed: jest.fn().mockResolvedValue(true),
    ...tracker,
  } as unknown as DeliveryTracker;
  const config = {
    get: (key: string) =>
      key === 'env'
        ? (opts.env ?? 'development')
        : { meta: { verifyToken: opts.verifyToken ?? VERIFY_TOKEN, appSecret: opts.appSecret ?? APP_SECRET } },
  } as unknown as ConfigService<Record<string, unknown>, true>;
  return { service: new MetaWebhookService(tracking, config), tracking };
}

const sign = (body: string) => `sha256=${createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex')}`;

describe('MetaWebhookService', () => {
  it('echoes the challenge only when the verify token matches', () => {
    const { service } = makeService();
    expect(service.verifyChallenge('subscribe', VERIFY_TOKEN, '12345')).toBe('12345');
    expect(service.verifyChallenge('subscribe', 'wrong', '12345')).toBeNull();
    expect(service.verifyChallenge('unsubscribe', VERIFY_TOKEN, '12345')).toBeNull();
  });

  it('validates the HMAC signature', () => {
    const { service } = makeService();
    const body = JSON.stringify({ hello: 'world' });
    expect(service.verifySignature(body, sign(body))).toBe(true);
    expect(service.verifySignature(body, 'sha256=deadbeef')).toBe(false);
    expect(service.verifySignature(body, undefined)).toBe(false);
  });

  it('fails CLOSED in production when no app secret is configured (H1)', () => {
    const { service } = makeService(undefined, { appSecret: '', env: 'production' });
    expect(service.verifySignature('{}', undefined)).toBe(false);
    expect(service.verifySignature('{}', 'sha256=whatever')).toBe(false);
  });

  it('rejects the verify challenge when no verify token is configured (H2)', () => {
    const { service } = makeService(undefined, { verifyToken: '' });
    expect(service.verifyChallenge('subscribe', '', '12345')).toBeNull();
    expect(service.verifyChallenge('subscribe', 'anything', '12345')).toBeNull();
  });

  it('applies delivery / read / failed statuses to tracking', async () => {
    const { service, tracking } = makeService();
    const payload = {
      entry: [{
        changes: [{
          value: {
            statuses: [
              { id: 'wamid.a', status: 'delivered' },
              { id: 'wamid.b', status: 'read' },
              { id: 'wamid.c', status: 'failed', errors: [{ message: 'undeliverable' }] },
            ],
          },
        }],
      }],
    };
    const res = await service.process(payload as never);
    expect(res.statuses).toBe(3);
    expect(tracking.markDelivered).toHaveBeenCalledWith('wamid.a');
    expect(tracking.markRead).toHaveBeenCalledWith('wamid.b');
    expect(tracking.markProviderFailed).toHaveBeenCalledWith('wamid.c', 'undeliverable');
  });

  it('counts inbound messages', async () => {
    const { service } = makeService();
    const payload = { entry: [{ changes: [{ value: { messages: [{ from: '+911', id: 'm1', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await service.process(payload as never);
    expect(res.messages).toBe(1);
  });
});
