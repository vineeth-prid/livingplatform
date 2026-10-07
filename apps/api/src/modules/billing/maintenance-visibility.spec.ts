import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { InvoiceService } from './invoice.service';

/**
 * Maintenance is financial information, so the rule has to hold at the API.
 *
 * Hiding the screen is not the fix — a tenant with a token can call the
 * endpoint. These tests drive `InvoiceService` directly, past every controller
 * and guard, which is exactly how someone would attack it.
 */
const OWNER: AuthenticatedUser = {
  id: 'user-owner', email: 'john@example.com', tenantId: 't-1', tenantIds: ['t-1'],
  roles: [], permissions: [PERMISSIONS.BILLING_INVOICE_READ],
};
const TENANT: AuthenticatedUser = { ...OWNER, id: 'user-tenant', email: 'rahul@example.com' };
const ADMIN: AuthenticatedUser = {
  ...OWNER,
  id: 'user-admin',
  permissions: [PERMISSIONS.BILLING_INVOICE_READ, PERMISSIONS.BILLING_DASHBOARD_READ],
};

const INVOICE = {
  id: 'inv-1', communityId: 'c-1', unitId: 'u-101', residentId: 'res-john',
  invoiceNumber: 'INV-2026-08-000001', cycle: 'MONTHLY',
  periodStart: new Date(), periodEnd: new Date(), issueDate: new Date(), dueDate: new Date(),
  baseAmount: 3000, lateFee: 0, adjustment: 0, totalAmount: 3000, paidAmount: 0,
  status: 'ISSUED', paidAt: null, notes: null,
  unit: { unitNumber: 'A-101', type: '2BHK' },
};

/** Only John owns u-101; Rahul rents it. */
function build() {
  const prisma = {
    maintenanceInvoice: {
      findFirst: jest.fn().mockResolvedValue(INVOICE),
      findMany: jest.fn().mockResolvedValue([INVOICE]),
      count: jest.fn().mockResolvedValue(1),
    },
    resident: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
  const ownership = {
    financiallyVisibleUnitIds: jest.fn((actor: AuthenticatedUser) =>
      Promise.resolve(actor.id === 'user-owner' ? ['u-101'] : []),
    ),
    canAccessUnitFinancials: jest.fn((actor: AuthenticatedUser) =>
      Promise.resolve(actor.id === 'user-owner'),
    ),
  };
  const svc = new InvoiceService(
    prisma as never,
    { assert: jest.fn().mockResolvedValue({ tenantId: 't-1' }) } as never,
    { publish: jest.fn() } as never,
    { get: () => ({ invoicePrefix: 'INV', defaultDueDay: 10, currency: 'INR' }) } as never,
    ownership as never,
  );
  return { svc, prisma, ownership };
}

describe('reading one invoice', () => {
  it('lets the owner open it', async () => {
    const { svc } = build();
    await expect(svc.findOne('c-1', 'inv-1', OWNER)).resolves.toMatchObject({ id: 'inv-1' });
  });

  it('refuses the tenant of the same flat', async () => {
    const { svc } = build();
    // The invoice EXISTS and names their unit — the refusal has to come from
    // the ownership check, not from the row being missing.
    await expect(svc.findOne('c-1', 'inv-1', TENANT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a manager open anything in their community', async () => {
    const { svc } = build();
    await expect(svc.findOne('c-1', 'inv-1', ADMIN)).resolves.toMatchObject({ id: 'inv-1' });
  });
});

describe('listing invoices', () => {
  it('scopes an owner to the units they are responsible for', async () => {
    const { svc, prisma } = build();
    await svc.findMany('c-1', { skip: 0, take: 20 } as never, OWNER);
    const where = prisma.maintenanceInvoice.findMany.mock.calls[0]![0].where;
    expect(where.unitId).toEqual({ in: ['u-101'] });
  });

  it('gives a tenant a filter that can match nothing', async () => {
    const { svc, prisma } = build();
    await svc.findMany('c-1', { skip: 0, take: 20 } as never, TENANT);
    const where = prisma.maintenanceInvoice.findMany.mock.calls[0]![0].where;
    // Not an empty filter — an empty `in` would be a missing filter, and a
    // missing filter here returns the whole community's billing.
    expect(where.unitId).toEqual({ in: ['__none__'] });
  });

  it('does not scope a manager by unit at all', async () => {
    const { svc, prisma } = build();
    await svc.findMany('c-1', { skip: 0, take: 20 } as never, ADMIN);
    const where = prisma.maintenanceInvoice.findMany.mock.calls[0]![0].where;
    expect(where.unitId).toBeUndefined();
  });
});

describe('my dues', () => {
  it('answers the owner with their unit’s bills', async () => {
    const { svc } = build();
    const dues = await svc.myDues('c-1', OWNER);
    expect(dues.outstanding).toBe(3000);
  });

  it('answers the tenant with nothing at all', async () => {
    const { svc, prisma } = build();
    const dues = await svc.myDues('c-1', TENANT);
    expect(dues).toEqual({
      outstanding: 0, currentDue: null, nextDue: null, overdueCount: 0, recent: [],
    });
    // And never even asked the database — there is nothing they could be shown.
    expect(prisma.maintenanceInvoice.findMany).not.toHaveBeenCalled();
  });
});
