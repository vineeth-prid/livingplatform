import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';
import { participantWhere } from './participant-scope';

function prismaWith(ids: { residents?: string[]; staff?: string[]; vendors?: string[] }) {
  const rows = (list: string[] = []) => jest.fn().mockResolvedValue(list.map((id) => ({ id })));
  return {
    resident: { findMany: rows(ids.residents) },
    staff: { findMany: rows(ids.staff) },
    vendor: { findMany: rows(ids.vendors) },
  } as unknown as PrismaService;
}

const user = (permissions: string[]): AuthenticatedUser => ({
  id: 'u-1', email: 'x@y.z', tenantId: 't', tenantIds: ['t'], roles: [], permissions,
});

describe('participantWhere (ticket / service-request visibility)', () => {
  it('managers (holding the assign permission) see the whole community', async () => {
    await expect(
      participantWhere(prismaWith({}), user(['ticket:view', 'ticket:assign']), 'ticket:assign', 'reportedById'),
    ).resolves.toBeNull();
  });

  it('a resident sees only what they raised or what was raised for them', async () => {
    const where = await participantWhere(
      prismaWith({ residents: ['r-1', 'r-2'] }), user(['ticket:view']), 'ticket:assign', 'reportedById',
    );
    expect(where).toEqual({
      OR: [{ reportedById: 'u-1' }, { residentId: { in: ['r-1', 'r-2'] } }],
    });
  });

  it('staff and vendors additionally see what is assigned to them', async () => {
    const where = await participantWhere(
      prismaWith({ staff: ['s-1'], vendors: ['v-1'] }), user(['service:view', 'service:update']), 'service:assign', 'requestedById',
    );
    expect(where).toEqual({
      OR: [
        { requestedById: 'u-1' },
        { assignedStaffId: { in: ['s-1'] } },
        { assignedVendorId: { in: ['v-1'] } },
      ],
    });
  });

  it('someone with no profile still only sees their own rows (never the community)', async () => {
    const where = await participantWhere(prismaWith({}), user(['ticket:view']), 'ticket:assign', 'reportedById');
    expect(where).toEqual({ OR: [{ reportedById: 'u-1' }] });
  });
});
