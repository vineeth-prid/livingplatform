import { randomBytes } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { slugify } from '../../common/utils/slug';
import { AuthService } from '../auth/auth.service';
import { TokensService } from '../auth/tokens.service';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ROLE_KEYS } from '../rbac/rbac.constants';
import { StorageService } from '../storage/storage.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { ProvisionCommunityDto } from './dto/provision-community.dto';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

/** A short, strong one-time password the admin hands to the new association admin. */
function generateTempPassword(): string {
  return randomBytes(12).toString('base64url'); // ~16 url-safe chars
}

/**
 * Platform-Admin control plane. Communities are the customer unit: each gets its
 * own tenant (isolation boundary) plus an Association Admin, provisioned
 * atomically. Only a Platform Admin may call this — associations cannot create
 * communities (that control stays with the operator).
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
    private readonly rbac: RbacService,
    private readonly tokens: TokensService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  async provisionCommunity(dto: ProvisionCommunityDto, actor: AuthenticatedUser) {
    if (!this.tenant.isPlatform) {
      throw new ForbiddenException('Only a Platform Admin can provision communities');
    }

    const email = dto.adminEmail.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const associationRole = await this.prisma.role.findFirstOrThrow({
      where: { tenantId: null, key: ROLE_KEYS.ASSOCIATION_ADMIN },
      select: { id: true },
    });

    const temporaryPassword = generateTempPassword();
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });
    // Tenant slug is globally unique; a random suffix avoids collisions across customers.
    const slug = `${slugify(dto.name)}-${randomBytes(3).toString('hex')}`;

    const { community, admin } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          status: 'ACTIVE',
          createdById: actor.id,
          updatedById: actor.id,
        },
      });

      const community = await tx.community.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          code: dto.code.toUpperCase(),
          slug: slugify(dto.name),
          type: dto.type,
          status: 'ACTIVE',
          city: dto.city,
          state: dto.state,
          timezone: 'Asia/Kolkata',
          createdById: actor.id,
          updatedById: actor.id,
          settings: { create: {} },
        },
      });

      const admin = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          tenantId: tenant.id,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
          createdById: actor.id,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      // Tenant-scoped grant (communityId null → all communities in this tenant).
      await tx.userRole.create({
        data: { userId: admin.id, roleId: associationRole.id, communityId: null, assignedById: actor.id },
      });

      return { community, admin };
    });

    this.events.publish({
      name: DomainEventName.CommunityCreated,
      ...this.events.from(actor, community.id),
      tenantId: community.tenantId,
      entityId: community.id,
      data: { name: community.name, code: community.code },
    });

    return {
      community: this.present(community),
      admin: { ...admin, temporaryPassword },
    };
  }

  /**
   * Reset the community admin's password and (by default) email it to them.
   *
   * The password is only ever knowable at this moment — it is stored as an
   * argon2 hash — so it is both returned to the caller and sent to the account.
   * The email is awaited rather than fired and forgotten: a platform admin who
   * is told "sent" has already dismissed the only screen showing the credential,
   * so a swallowed SMTP failure would strand the community admin locked out.
   */
  async resetCommunityAdminPassword(communityId: string, actor: AuthenticatedUser, sendEmail: boolean) {
    if (!this.tenant.isPlatform) {
      throw new ForbiddenException('Only a Platform Admin can reset a community admin password');
    }
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
      select: { id: true, tenantId: true, name: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const admin = await this.findAssociationAdmin(community.tenantId, true);
    if (!admin) throw new NotFoundException('This community has no association admin');

    const reset = await this.auth.adminResetPassword(admin.id, actor);

    let emailedTo: string | null = null;
    if (sendEmail) {
      await this.mail.sendAdminTemporaryPassword({
        to: admin.email,
        username: admin.email,
        temporaryPassword: reset.temporaryPassword,
        communityName: community.name,
      });
      emailedTo = admin.email;
    }

    return {
      ...reset,
      email: admin.email,
      emailedTo,
    };
  }

  /**
   * Mints a session for a community's Association Admin so a Platform Admin can
   * operate inside that community ("log in as"). Platform-only; the caller keeps
   * their own tokens client-side to return. The impersonation is audit-logged.
   */
  async loginAsCommunity(communityId: string, actor: AuthenticatedUser, meta: RequestMeta) {
    if (!this.tenant.isPlatform) {
      throw new ForbiddenException('Only a Platform Admin can sign in as a community');
    }

    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
      select: { id: true, tenantId: true, name: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const admin = await this.findAssociationAdmin(community.tenantId, true);
    if (!admin) {
      throw new NotFoundException('This community has no association admin to sign in as');
    }

    // ponytail: audit trail via the app log; promote to a domain/audit event if
    // impersonation needs to surface in the in-app audit timeline.
    this.logger.warn(
      `Platform admin ${actor.email} (${actor.id}) signed in as ${admin.email} for community "${community.name}" (${community.id})`,
    );

    const principal = await this.rbac.buildPrincipal({
      id: admin.id, email: admin.email, tenantId: admin.tenantId,
    });
    // Stamp the real operator on the session so every action taken while
    // impersonating stays attributable to them (carried across token refresh).
    const pair = await this.tokens.issuePair(principal, false, meta, { id: actor.id, email: actor.email });

    return {
      ...pair,
      user: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        tenantId: admin.tenantId,
        status: admin.status,
        emailVerified: admin.emailVerifiedAt !== null,
        roles: principal.roles.map((r) => r.key),
      },
    };
  }

  /**
   * The community's Association Admin login, for the operator's Communities
   * table.
   *
   * There is deliberately no way to READ the password back: it is stored as an
   * argon2 hash and nothing on the platform can reverse that — not this
   * endpoint, not the database, not us. The honest affordance is "reset and
   * show the new one once", which is `POST /auth/users/:id/reset-password`.
   * This returns who to reset, so the operator can find the account without
   * impersonating first.
   */
  async communityAdmin(communityId: string) {
    if (!this.tenant.isPlatform) {
      throw new ForbiddenException('Only a Platform Admin can view community admin accounts');
    }

    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
      select: { tenantId: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    // Not active-only: an operator most needs this when the account is locked
    // or suspended, which is exactly when an active-only lookup would hide it.
    const admin = await this.findAssociationAdmin(community.tenantId, false);
    if (!admin) throw new NotFoundException('This community has no association admin');

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      status: admin.status,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  /** The community's Association Admin — oldest first, so it is stable. */
  private findAssociationAdmin(tenantId: string, activeOnly: boolean) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        ...(activeOnly ? { status: 'ACTIVE' as const } : {}),
        roles: { some: { role: { key: ROLE_KEYS.ASSOCIATION_ADMIN } } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        tenantId: true, status: true, emailVerifiedAt: true,
        mustChangePassword: true, lastLoginAt: true,
      },
    });
  }

  private present<T extends { logoKey: string | null; coverImageKey: string | null }>(c: T) {
    return {
      ...c,
      logoUrl: this.storage.resolveUrl(c.logoKey),
      coverImageUrl: this.storage.resolveUrl(c.coverImageKey),
    };
  }
}
