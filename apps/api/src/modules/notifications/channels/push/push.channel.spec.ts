import { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../../../prisma/prisma.service';
import { PushChannel } from './push.channel';

/** A real, valid VAPID pair — generated for tests only, never used to send. */
const VALID_PUBLIC =
  'BKjxlMbEigfMNeooXiBPFuLnn9scH36LsH2VX0oxrjmlVjJOr5iQPpzzSUs1RaanlqOoldYG-RZUV6a7O2_1F9k';
const VALID_PRIVATE = 'RjP0M_IfHJ2TiuYRSOh9sOU6wQRv-g8WEG0CMW1sFq8';

function makeChannel(push: {
  subject?: string;
  publicKey?: string;
  privateKey?: string;
  ttl?: number;
}) {
  const config = {
    get: () => ({
      subject: 'mailto:support@living.local',
      publicKey: '',
      privateKey: '',
      ttl: 900,
      ...push,
    }),
  } as unknown as ConfigService;
  const prisma = {
    pushSubscription: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return new PushChannel(prisma, config as never);
}

/**
 * `webpush.setVapidDetails` throws on a malformed subject or a wrong-length key,
 * and it runs in this provider's CONSTRUCTOR. Left unguarded, one typo'd
 * environment variable takes the entire API down at boot instead of disabling a
 * single notification channel.
 */
describe('PushChannel — VAPID configuration', () => {
  it('is healthy with a valid pair', async () => {
    const channel = makeChannel({ publicKey: VALID_PUBLIC, privateKey: VALID_PRIVATE });

    await expect(channel.health()).resolves.toMatchObject({ state: 'healthy' });
    await expect(channel.verify()).resolves.toBe(true);
  });

  it('reports unconfigured — not unhealthy-with-an-error — when keys are absent', async () => {
    const channel = makeChannel({});

    await expect(channel.health()).resolves.toMatchObject({
      state: 'unhealthy',
      reason: 'VAPID keys are not configured',
    });
  });

  it('does not throw at construction when the subject is invalid', () => {
    expect(() =>
      makeChannel({ subject: 'vini@example.com', publicKey: VALID_PUBLIC, privateKey: VALID_PRIVATE }),
    ).not.toThrow();
  });

  it('does not throw at construction when a key is malformed', () => {
    expect(() =>
      makeChannel({ publicKey: 'too-short', privateKey: VALID_PRIVATE }),
    ).not.toThrow();
  });

  /** "Set up wrongly" needs a different fix from "never set up", and this is
   *  the screen an admin checks first. */
  it('distinguishes a misconfiguration from an absent one', async () => {
    const channel = makeChannel({
      subject: 'vini@example.com',
      publicKey: VALID_PUBLIC,
      privateKey: VALID_PRIVATE,
    });

    const health = await channel.health();
    expect(health.state).toBe('unhealthy');
    expect(health.reason).toMatch(/VAPID configuration is invalid/);
    await expect(channel.verify()).resolves.toBe(false);
  });

  it('refuses to send when misconfigured, and says why', async () => {
    const channel = makeChannel({ publicKey: 'too-short', privateKey: VALID_PRIVATE });

    await expect(
      channel.send({ channel: 'push', to: 'user-1', subject: 'Hi', text: 'There' }),
    ).rejects.toThrow(/misconfigured/);
  });

  it('accepts a bare mailto: subject', async () => {
    const channel = makeChannel({
      subject: 'mailto:vini.roks@gmail.com',
      publicKey: VALID_PUBLIC,
      privateKey: VALID_PRIVATE,
    });

    await expect(channel.health()).resolves.toMatchObject({ state: 'healthy' });
  });
});
