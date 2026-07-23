import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import { ROLE_KEYS, type RoleKey } from '../rbac/rbac.constants';
import type { ProfileKind } from './user-link.service';

/** Common one-time password for provisioned people accounts. The portal forces
 *  a change on first login (users.mustChangePassword). */
export const ONE_TIME_PASSWORD = 'Living@123';

/** Strip a phone number down to its digits so "+91 98765 43210" and
 *  "9876543210" collide as intended. Keeps the last 10+ digits as-is. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

const ROLE_FOR_KIND: Record<ProfileKind, RoleKey> = {
  resident: ROLE_KEYS.RESIDENT,
  staff: ROLE_KEYS.STAFF,
  vendor: ROLE_KEYS.VENDOR,
};

export interface ProvisionLoginInput {
  kind: ProfileKind;
  tenantId: string;
  /** Community-scoped role grant target (null for tenant-wide, e.g. vendors). */
  communityId: string | null;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  actorId: string;
}

/**
 * Creates the login account for a person (resident/staff/vendor): username =
 * mobile number, common one-time password, forced change on first login.
 *
 * Phone uniqueness rule: one phone → one user account. A second RESIDENT
 * profile with the same phone is allowed (an owner can own several flats) and
 * simply shares the account (only the first profile row is user-linked). Any
 * other cross-kind reuse is a conflict.
 */
@Injectable()
export class AccountProvisioningService {
  private readonly logger = new Logger(AccountProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the userId to link on the new profile row, or null when the
   * account already exists and is linked elsewhere (allowed multi-flat owner).
   * Throws ConflictException when the phone is taken by a different kind.
   */
  async provisionLogin(input: ProvisionLoginInput): Promise<string | null> {
    const username = normalizePhone(input.phone);
    if (username.length < 7) {
      throw new ConflictException('A valid mobile number is required — it becomes the login username');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username },
      include: {
        residentProfile: { select: { id: true } },
        staffProfile: { select: { id: true } },
        vendorProfile: { select: { id: true } },
      },
    });

    if (existing) {
      const linkedKind: ProfileKind | null = existing.residentProfile
        ? 'resident'
        : existing.staffProfile
          ? 'staff'
          : existing.vendorProfile
            ? 'vendor'
            : null;
      // An owner may own multiple flats — same phone, another resident row.
      if (input.kind === 'resident' && (linkedKind === 'resident' || linkedKind === null) && existing.tenantId === input.tenantId) {
        return linkedKind === null ? existing.id : null;
      }
      if (linkedKind === null && existing.tenantId === input.tenantId) {
        return existing.id;
      }
      throw new ConflictException('This phone number is already registered to another user');
    }

    const role = await this.prisma.role.findFirst({
      where: { tenantId: null, key: ROLE_FOR_KIND[input.kind] },
      select: { id: true },
    });

    const email = input.email?.toLowerCase() || `${username}@living.local`;
    const emailTaken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await argon2.hash(ONE_TIME_PASSWORD, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email,
        username,
        passwordHash,
        mustChangePassword: true,
        firstName: input.firstName,
        lastName: input.lastName,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        createdById: input.actorId,
        ...(role
          ? {
              roles: {
                create: {
                  roleId: role.id,
                  communityId: input.communityId,
                  assignedById: input.actorId,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });
    if (!role) {
      this.logger.warn(`No system role for kind "${input.kind}" — account ${user.id} created without a role grant`);
    }
    return user.id;
  }
}
