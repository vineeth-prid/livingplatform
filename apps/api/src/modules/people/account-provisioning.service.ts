import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_KEYS, type RoleKey } from '../rbac/rbac.constants';
import type { ProfileKind } from './user-link.service';

/**
 * Fallback one-time password for provisioned people accounts. The ACTIVE value
 * comes from AUTH_DEFAULT_PASSWORD (see configuration.ts) — this constant is
 * only the documented default so a dev environment works out of the box. The
 * portal forces a change on first login (users.mustChangePassword).
 */
export const ONE_TIME_PASSWORD = 'Living@123';

/** An Indian mobile number is 10 digits; anything before that is a country code. */
const MOBILE_DIGITS = 10;

/**
 * Reduce a phone number to the 10 digits that identify it.
 *
 * Punctuation and spacing go, and so does any country or trunk prefix — "+91
 * 98765 43210", "0091-9876543210", "09876543210" and "9876543210" all become
 * 9876543210. That collapse is the point: the number IS the login username, so
 * two spellings of one person's mobile must never become two accounts, which is
 * exactly what happened while the country code survived normalisation.
 *
 * Shorter values are returned as-is rather than padded — they are rejected as
 * usernames upstream, and quietly reshaping them would hide a bad input.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > MOBILE_DIGITS ? digits.slice(-MOBILE_DIGITS) : digits;
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
  private readonly oneTimePassword: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.oneTimePassword = config.get('auth', { infer: true }).defaultPassword;
  }

  /** The one-time password this deployment hands out (for admin-facing copy). */
  get defaultPassword(): string {
    return this.oneTimePassword;
  }

  /**
   * Returns the userId to link on the new profile row, or null when the
   * account already exists and is linked elsewhere (allowed multi-flat owner).
   * Throws ConflictException when the phone is taken by a different kind.
   */
  async provisionLogin(input: ProvisionLoginInput): Promise<string | null> {
    const username = normalizePhone(input.phone);
    if (username.length !== MOBILE_DIGITS) {
      throw new ConflictException(
        `A valid ${MOBILE_DIGITS}-digit mobile number is required — it becomes the login username. ` +
          'A country code is fine and is removed automatically.',
      );
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

    const passwordHash = await argon2.hash(this.oneTimePassword, { type: argon2.argon2id });
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

  /**
   * Keep a staff member's SECURITY role grant in step with their job title.
   *
   * SECURITY is additive to STAFF, so this only ever adds or removes that one
   * grant — a guard keeps their ordinary staff access either way. Called on
   * create AND on update, which is what makes promoting a housekeeper to the
   * gate (or moving a guard off it) actually take effect rather than being
   * frozen at whatever they were provisioned as.
   *
   * Idempotent: safe to call with the same value repeatedly.
   */
  /**
   * Move a person's login to a new mobile number.
   *
   * The mobile IS the username, so changing it on the profile without changing
   * it on the account left the person signing in with the OLD number
   * indefinitely — the edit looked saved and changed nothing that mattered.
   *
   * Only renames an account whose username still matches the OLD number. If it
   * differs, someone set the username deliberately and an edit to a profile
   * phone must not silently take it over.
   *
   * The synthetic `<number>@living.local` email moves too, since it is derived
   * from the number and nothing else. A REAL email address is left alone.
   *
   * Returns true when the login actually moved.
   */
  async syncLoginPhone(input: {
    userId: string | null | undefined;
    oldPhone: string | null | undefined;
    newPhone: string;
    actorId: string;
  }): Promise<boolean> {
    if (!input.userId) return false;

    const next = normalizePhone(input.newPhone);
    const previous = normalizePhone(input.oldPhone ?? '');
    if (!next || next === previous) return false;
    if (next.length !== MOBILE_DIGITS) {
      throw new ConflictException(
        `A valid ${MOBILE_DIGITS}-digit mobile number is required — it becomes the login username. ` +
          'A country code is fine and is removed automatically.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, username: true, email: true },
    });
    if (!user) return false;

    // Someone chose this username explicitly — leave it to them.
    if (user.username !== previous) return false;

    const clash = await this.prisma.user.findUnique({
      where: { username: next },
      select: { id: true },
    });
    if (clash && clash.id !== user.id) {
      throw new ConflictException(
        'Another account already signs in with this mobile number. Change that account first, ' +
          'or give this person a different number.',
      );
    }

    const syntheticEmail = `${previous}@living.local`;
    const nextEmail = user.email === syntheticEmail ? `${next}@living.local` : user.email;
    if (nextEmail !== user.email) {
      const emailClash = await this.prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      });
      if (emailClash && emailClash.id !== user.id) {
        throw new ConflictException('Another account already uses the email for this mobile number');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { username: next, email: nextEmail, updatedById: input.actorId },
    });
    this.logger.log(`Login moved ${previous} → ${next} for user ${user.id}`);
    return true;
  }

  async syncSecurityRole(
    userId: string | null,
    communityId: string,
    isSecurity: boolean,
    actorId: string,
  ): Promise<void> {
    // No linked login (e.g. a second profile sharing one account) — nothing to grant.
    if (!userId) return;

    const role = await this.prisma.role.findFirst({
      where: { tenantId: null, key: ROLE_KEYS.SECURITY },
      select: { id: true },
    });
    if (!role) {
      this.logger.warn('SECURITY system role is missing — reseed required for gate access');
      return;
    }

    const where = { userId_roleId_communityId: { userId, roleId: role.id, communityId } };

    if (isSecurity) {
      await this.prisma.userRole.upsert({
        where,
        create: { userId, roleId: role.id, communityId, assignedById: actorId },
        update: {},
      });
      return;
    }

    // deleteMany, not delete: removing a grant that was never there must not throw.
    await this.prisma.userRole.deleteMany({
      where: { userId, roleId: role.id, communityId },
    });
  }

  /**
   * Whether a staff job title should carry gate duty. The title is a free
   * per-tenant string (CatalogOption), so this compares loosely rather than
   * against an enum — but ONLY 'SECURITY' matches. Deliberately no mapping for
   * 'FACILITY_MANAGER' or 'ADMIN': letting a dropdown silently confer manager
   * permissions would be a privilege-escalation path, and those roles are
   * assigned explicitly through role management.
   */
  static isSecurityJobRole(jobRole: string | null | undefined): boolean {
    return (jobRole ?? '').trim().toUpperCase() === 'SECURITY';
  }
}
