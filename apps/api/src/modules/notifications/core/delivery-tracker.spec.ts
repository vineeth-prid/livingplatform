import type { PrismaService } from '../../prisma/prisma.service';
import { DeliveryTracker } from './delivery-tracker';

describe('DeliveryTracker.createQueuedOnce', () => {
  const ctx = { channel: 'whatsapp' as const, provider: 'openwa', maxAttempts: 3, dedupeKey: 'k-1' };
  const msg = { channel: 'whatsapp' as const, to: '+919820000001' };

  it('returns the new row id the first time', async () => {
    const prisma = { notificationDelivery: { create: jest.fn().mockResolvedValue({ id: 'd-1' }) } } as unknown as PrismaService;
    await expect(new DeliveryTracker(prisma).createQueuedOnce(msg, ctx)).resolves.toBe('d-1');
  });

  it('returns null when the unique dedupe key already exists', async () => {
    const prisma = {
      notificationDelivery: { create: jest.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' })) },
    } as unknown as PrismaService;
    await expect(new DeliveryTracker(prisma).createQueuedOnce(msg, ctx)).resolves.toBeNull();
  });

  it('still throws any other database error', async () => {
    const prisma = { notificationDelivery: { create: jest.fn().mockRejectedValue(new Error('down')) } } as unknown as PrismaService;
    await expect(new DeliveryTracker(prisma).createQueuedOnce(msg, ctx)).rejects.toThrow('down');
  });
});
