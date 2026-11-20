import { ServiceRequestService } from './service-request.service';

/** A resident may withdraw their own booking until it is accepted — never once paid. */
describe('ServiceRequestService.cancelMine', () => {
  const me = { id: 'user-1', permissions: [] } as never;

  function build(row: Record<string, unknown>) {
    const request = { id: 'sr-1', number: 1, communityId: 'c1', requestedById: 'user-1', residentId: null, status: 'ASSIGNED', paidAt: null, ...row };
    const prisma = {
      serviceRequest: { update: jest.fn(({ data }) => Promise.resolve({ ...request, ...data })) },
      resident: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const svc = new ServiceRequestService(prisma as never, {} as never, {} as never, {} as never, {} as never,
      { publish: jest.fn(), from: jest.fn() } as never, {} as never, {} as never);
    jest.spyOn(svc as never, 'loadOrThrow').mockResolvedValue(request as never);
    return { svc, prisma };
  }

  it('cancels my booking before anyone accepts it', async () => {
    const { svc } = build({});
    await expect(svc.cancelMine('sr-1', 'Travelling', me)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('refuses once accepted, once paid, or for someone else\'s booking', async () => {
    await expect(build({ status: 'ACCEPTED' }).svc.cancelMine('sr-1', undefined, me)).rejects.toThrow(/already been accepted/);
    await expect(build({ paidAt: new Date() }).svc.cancelMine('sr-1', undefined, me)).rejects.toThrow(/refund/);
    await expect(build({ requestedById: 'someone-else' }).svc.cancelMine('sr-1', undefined, me)).rejects.toThrow(/your own/);
  });
});
