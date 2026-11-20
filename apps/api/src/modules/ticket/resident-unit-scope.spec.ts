import { ForbiddenException } from '@nestjs/common';

import { TicketService } from './ticket.service';

/**
 * A resident raises complaints only for a unit they live in or own; staff and
 * managers (ticket:update) for any unit. Any unit id used to be accepted.
 */
describe('TicketService.create — which unit a resident may complain about', () => {
  const dto = { unitId: 'u-other', categoryId: 'cat', title: 'Leak', description: 'x' } as never;

  function build(residentOfUnit: boolean) {
    const prisma = {
      unit: { findFirst: jest.fn().mockResolvedValue({ id: 'u-other' }) },
      resident: { findFirst: jest.fn().mockResolvedValue(residentOfUnit ? { id: 'r1' } : null) },
      ticket: { create: jest.fn() },
    };
    const svc = new TicketService(
      prisma as never,
      { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as never,
      { assertUsable: jest.fn() } as never,
      {} as never, {} as never, {} as never, { publish: jest.fn() } as never, {} as never, {} as never,
    );
    return { svc, prisma };
  }

  it('refuses a resident a unit they neither live in nor own', async () => {
    const { svc, prisma } = build(false);
    await expect(svc.create('c1', dto, { id: 'user-1', permissions: ['ticket:create'] } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('checks both living there and owning it (a landlord may report their let flat)', async () => {
    const { svc, prisma } = build(false);
    await svc.create('c1', dto, { id: 'user-1', permissions: ['ticket:create'] } as never).catch(() => undefined);
    const where = prisma.resident.findFirst.mock.calls[0][0].where;
    expect(JSON.stringify(where.OR)).toContain('unitAssignment');
    expect(JSON.stringify(where.OR)).toContain('ownedUnits');
  });

  it('does not restrict staff or managers', async () => {
    const { svc, prisma } = build(false);
    await svc.create('c1', dto, { id: 'admin', permissions: ['ticket:create', 'ticket:update'] } as never).catch(() => undefined);
    expect(prisma.resident.findFirst.mock.calls.some((c) => JSON.stringify(c[0]).includes('ownedUnits'))).toBe(false);
  });
});
