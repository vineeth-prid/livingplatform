import { ServiceRequestService } from './service-request.service';

jest.mock('../community-ops/resident-access', () => ({
  myOccupancies: jest.fn().mockResolvedValue([{ unitId: 'u1', residentId: 'r1' }]),
}));

/**
 * Pay first, then assign: a resident's priced booking waits unassigned for its
 * payment, and the payment.succeeded event is what routes it to a vendor.
 */
describe('ServiceRequestService — pay-first bookings', () => {
  const resident = { id: 'user-1', tenantId: 't1', permissions: [] } as never;

  function build({ price = 500, rail = true } = {}) {
    const row = { id: 'sr-1', number: 1, communityId: 'c1', serviceId: 's1', status: 'REQUESTED' };
    const prisma = {
      unit: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }) },
      service: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ basePrice: price, estimatedDurationMinutes: null, variants: [] }),
      },
      communityPaymentConfig: { findFirst: jest.fn().mockResolvedValue(rail ? { id: 'cfg' } : null) },
      serviceRequest: {
        create: jest.fn(({ data }) => Promise.resolve({ ...row, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      },
      community: { findUniqueOrThrow: jest.fn().mockResolvedValue({ tenantId: 't1' }) },
    };
    const svc = new ServiceRequestService(
      prisma as never,
      { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as never,
      { assertUsable: jest.fn() } as never,
      {} as never,
      {} as never,
      { publish: jest.fn(), from: jest.fn() } as never,
      {} as never,
      {} as never,
    );
    const autoAssign = jest.spyOn(svc as never, 'tryAutoAssign').mockResolvedValue(null as never);
    return { svc, prisma, autoAssign };
  }

  const dto = { serviceId: 's1', unitId: 'u1', title: 'Deep clean', description: 'Kitchen' } as never;

  it('holds a priced resident booking unassigned until it is paid', async () => {
    const { svc, prisma, autoAssign } = build();
    const res = await svc.create('c1', dto, resident);
    expect(prisma.serviceRequest.create.mock.calls[0][0].data.paymentRequired).toBe(true);
    expect(res.status).toBe('REQUESTED');
    expect(autoAssign).not.toHaveBeenCalled();
  });

  it('keeps book-and-assign for a free service or a community with no payment account', async () => {
    for (const opts of [{ price: 0 }, { rail: false }]) {
      const { svc, prisma, autoAssign } = build(opts);
      await svc.create('c1', dto, resident);
      expect(prisma.serviceRequest.create.mock.calls[0][0].data.paymentRequired).toBe(false);
      expect(autoAssign).toHaveBeenCalled();
    }
  });

  it('assigns once the payment settles — and only once', async () => {
    const { svc, prisma, autoAssign } = build();
    const event = { actorId: 'user-1', entityId: 'pay-1', data: { serviceRequestId: 'sr-1' } } as never;
    await svc.onPaymentSucceeded(event);
    expect(autoAssign).toHaveBeenCalledTimes(1);

    prisma.serviceRequest.updateMany.mockResolvedValue({ count: 0 }); // webhook after callback
    await svc.onPaymentSucceeded(event);
    expect(autoAssign).toHaveBeenCalledTimes(1);
  });
});
