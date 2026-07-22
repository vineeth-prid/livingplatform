import { randomBytes } from 'crypto';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { slugify } from '../../common/utils/slug';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_KEYS } from '../rbac/rbac.constants';
import { StorageService } from '../storage/storage.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { ProvisionCommunityDto } from './dto/provision-community.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
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
          status: 'ONBOARDING',
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

  private present<T extends { logoKey: string | null; coverImageKey: string | null }>(c: T) {
    return {
      ...c,
      logoUrl: this.storage.resolveUrl(c.logoKey),
      coverImageUrl: this.storage.resolveUrl(c.coverImageKey),
    };
  }
}
