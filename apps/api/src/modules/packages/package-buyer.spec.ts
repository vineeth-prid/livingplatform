import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PackagePurchaseService } from './package-purchase.service';

/**
 * Who may buy a package, and for which unit. Packages follow OCCUPANCY: the
 * tenant or owner-occupier living in the flat buys for that flat. An owner whose
 * flat is let has no home to redeem visits against, and nobody buys for a flat
 * they do not live in.
 */
const ACTOR = { id: 'u-1', permissions: [] } as unknown as AuthenticatedUser;

function buyer(opts: { homes: { unitId: string; residentId: string }[]; residents: string[] }) {
  const prisma = {
    residentUnit: { findMany: jest.fn().mockResolvedValue(opts.homes) },
    resident: { findMany: jest.fn().mockResolvedValue(opts.residents.map((id) => ({ id }))) },
  };
  const svc = new PackagePurchaseService(prisma as never, {} as never, {} as never);
  return (unitId?: string) =>
    (svc as unknown as {
      resolveBuyer(c: string, u: string | undefined, a: AuthenticatedUser): Promise<{ residentId: string | null; unitId: string | null }>;
    }).resolveBuyer('c-1', unitId, ACTOR);
}

describe('package buyer', () => {
  it('a tenant buys for the flat they live in', async () => {
    const resolve = buyer({ homes: [{ unitId: 'u-101', residentId: 'res-rahul' }], residents: ['res-rahul'] });
    await expect(resolve()).resolves.toEqual({ residentId: 'res-rahul', unitId: 'u-101' });
  });

  it('cannot buy against someone else’s flat', async () => {
    const resolve = buyer({ homes: [{ unitId: 'u-101', residentId: 'res-rahul' }], residents: ['res-rahul'] });
    await expect(resolve('u-999')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('an owner whose flat is let is refused before paying for unusable visits', async () => {
    const resolve = buyer({ homes: [], residents: ['res-john'] });
    await expect(resolve()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('someone who is not a resident here gets no buyer', async () => {
    const resolve = buyer({ homes: [], residents: [] });
    await expect(resolve()).resolves.toEqual({ residentId: null, unitId: null });
  });
});
