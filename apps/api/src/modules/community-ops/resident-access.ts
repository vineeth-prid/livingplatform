import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Resident data-ownership guard shared by visitors and bookings: a resident may
 * only act on their OWN record (matched via the linked userId); a manager (one
 * holding `managePermission`, e.g. a Facility Manager) may act for any resident
 * in the community. Also validates community membership.
 */
export async function assertResidentOwnership(
  prisma: PrismaService,
  residentId: string,
  communityId: string,
  user: AuthenticatedUser,
  managePermission: string,
): Promise<void> {
  const resident = await prisma.resident.findFirst({
    where: { id: residentId, communityId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!resident) throw new BadRequestException('Resident does not belong to this community');
  if (user.permissions.includes(managePermission)) return;
  if (resident.userId !== user.id) {
    throw new ForbiddenException('You can only act on your own record');
  }
}

/** The caller's own resident ids in a community (for scoping self-service lists). */
export async function myResidentIds(
  prisma: PrismaService,
  user: AuthenticatedUser,
  communityId: string,
): Promise<string[]> {
  const residents = await prisma.resident.findMany({
    where: { communityId, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  return residents.map((r) => r.id);
}
