import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type ProfileKind = 'resident' | 'vendor' | 'staff';

/**
 * Enforces "a platform User maps to at most ONE people profile" across the
 * resident/vendor/staff tables. Each table has a unique `userId` (single-table
 * safety); this service adds the CROSS-table guarantee the DB can't express, and
 * checks the user belongs to the same tenant. Linking lets a person log in
 * without a duplicate account — the seam the Ticket Engine will use to resolve
 * "who is this authenticated user, operationally?".
 */
@Injectable()
export class UserLinkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws unless `userId` may be linked to a profile in `tenantId`.
   * `exclude` skips the profile being updated so re-saving its own link is fine.
   */
  async assertLinkable(
    userId: string,
    tenantId: string,
    exclude?: { kind: ProfileKind; id: string },
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!user) throw new NotFoundException('Linked user not found');
    if (user.tenantId !== tenantId) {
      throw new BadRequestException('User belongs to a different tenant');
    }

    const not = (kind: ProfileKind) =>
      exclude?.kind === kind ? { id: { not: exclude.id } } : {};

    const [resident, vendor, staff] = await Promise.all([
      this.prisma.resident.findFirst({
        where: { userId, ...not('resident') },
        select: { id: true },
      }),
      this.prisma.vendor.findFirst({
        where: { userId, ...not('vendor') },
        select: { id: true },
      }),
      this.prisma.staff.findFirst({
        where: { userId, ...not('staff') },
        select: { id: true },
      }),
    ]);

    if (resident || vendor || staff) {
      throw new ConflictException(
        'This user is already linked to another profile',
      );
    }
  }
}
