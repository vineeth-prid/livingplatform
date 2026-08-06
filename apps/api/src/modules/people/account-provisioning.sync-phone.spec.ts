import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../prisma/prisma.service';
import { AccountProvisioningService } from './account-provisioning.service';

/**
 * The mobile number IS the login username.
 *
 * Editing it on the profile without moving the account left the person signing
 * in with their OLD number for good: the admin's edit looked saved, the new
 * number did nothing, and the old one kept working. These pin the move and,
 * more importantly, the cases where it must NOT happen.
 */
function makeService(user: Record<string, unknown> | null, clash?: Record<string, unknown> | null) {
  const findUnique = jest.fn(({ where }: { where: Record<string, unknown> }) => {
    if (where.id) return Promise.resolve(user);
    if (where.username) return Promise.resolve(clash ?? null);
    if (where.email) return Promise.resolve(null);
    return Promise.resolve(null);
  });
  const prisma = {
    user: { findUnique, update: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;

  const config = {
    get: () => ({ defaultPassword: 'Living@123' }),
  } as unknown as ConfigService<never, true>;

  return { service: new AccountProvisioningService(prisma, config as never), prisma };
}

const USER = {
  id: 'u-1',
  username: '9876543210',
  email: '9876543210@living.local',
};

describe('AccountProvisioningService.syncLoginPhone', () => {
  it('moves the username so the NEW number signs in', async () => {
    const { service, prisma } = makeService(USER);

    const moved = await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '9876543210', newPhone: '9000011111', actorId: 'a-1',
    });

    expect(moved).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ username: '9000011111' }) }),
    );
  });

  it('carries the synthetic email across, since it is derived from the number', async () => {
    const { service, prisma } = makeService(USER);

    await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '9876543210', newPhone: '9000011111', actorId: 'a-1',
    });

    expect((prisma.user.update as jest.Mock).mock.calls[0][0].data.email)
      .toBe('9000011111@living.local');
  });

  it('leaves a REAL email address alone', async () => {
    const { service, prisma } = makeService({ ...USER, email: 'aisha@example.com' });

    await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '9876543210', newPhone: '9000011111', actorId: 'a-1',
    });

    expect((prisma.user.update as jest.Mock).mock.calls[0][0].data.email)
      .toBe('aisha@example.com');
  });

  it('ignores pure formatting — spaces and dashes are not a new number', async () => {
    const { service, prisma } = makeService(USER);

    const moved = await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '9876543210', newPhone: '98765 43210', actorId: 'a-1',
    });

    expect(moved).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  /**
   * The whole point of collapsing to 10 digits: adding, removing or changing a
   * country code is not a new number, so it must not move the login and must
   * never produce a second account for the same person.
   */
  it.each([
    ['+91 98765 43210'],
    ['0091-9876543210'],
    ['09876543210'],
  ])('treats %s as the same number, not a new one', async (spelling) => {
    const { service, prisma } = makeService(USER);

    const moved = await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '9876543210', newPhone: spelling, actorId: 'a-1',
    });

    expect(moved).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('a genuinely different number still moves, country code or not', async () => {
    const { service, prisma } = makeService(USER);

    await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '+91 98765 43210', newPhone: '+91 90000 11111', actorId: 'a-1',
    });

    expect((prisma.user.update as jest.Mock).mock.calls[0][0].data.username)
      .toBe('9000011111');
  });

  it('refuses when another account already signs in with that number', async () => {
    const { service } = makeService(USER, { id: 'u-2' });

    await expect(
      service.syncLoginPhone({
        userId: 'u-1', oldPhone: '9876543210', newPhone: '9000011111', actorId: 'a-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not hijack a username somebody set deliberately', async () => {
    const { service, prisma } = makeService({ ...USER, username: 'aisha.khan' });

    const moved = await service.syncLoginPhone({
      userId: 'u-1', oldPhone: '9876543210', newPhone: '9000011111', actorId: 'a-1',
    });

    expect(moved).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does nothing for a profile with no login account', async () => {
    const { service, prisma } = makeService(null);

    await expect(
      service.syncLoginPhone({ userId: null, oldPhone: '9876543210', newPhone: '9000011111', actorId: 'a-1' }),
    ).resolves.toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a 10-digit mobile', async () => {
    const { service } = makeService(USER);

    await expect(
      service.syncLoginPhone({ userId: 'u-1', oldPhone: '9876543210', newPhone: '123', actorId: 'a-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.syncLoginPhone({ userId: 'u-1', oldPhone: '9876543210', newPhone: '98765 4321', actorId: 'a-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
