import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Row-level visibility for tickets and service requests.
 *
 * Community access alone is not enough: every resident holds `ticket:view` and
 * `service:view`, so a community-only check let any resident list — and open —
 * every neighbour's request, mobile number and in-home photos included.
 *
 * A caller holding the manage permission (assign — association admin, facility
 * manager) sees the whole community. Everyone else sees only the rows they are
 * a party to: raised by them, raised for one of their resident records, or
 * assigned to their staff / vendor profile. That is exactly the filter the
 * resident and workforce apps were already applying client-side, so no screen
 * loses a row it used to show.
 *
 * Returns `null` for "no restriction", otherwise a Prisma-compatible `OR`.
 */
export async function participantWhere<W extends object>(
  prisma: PrismaService,
  user: AuthenticatedUser,
  managePermission: string,
  creatorField: 'reportedById' | 'requestedById',
): Promise<W | null> {
  if (user.permissions.includes(managePermission)) return null;

  const [residents, staff, vendors] = await Promise.all([
    prisma.resident.findMany({ where: { userId: user.id, deletedAt: null }, select: { id: true } }),
    prisma.staff.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.vendor.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  const or: Record<string, unknown>[] = [{ [creatorField]: user.id }];
  if (residents.length) or.push({ residentId: { in: ids(residents) } });
  if (staff.length) or.push({ assignedStaffId: { in: ids(staff) } });
  if (vendors.length) or.push({ assignedVendorId: { in: ids(vendors) } });
  return { OR: or } as W;
}
