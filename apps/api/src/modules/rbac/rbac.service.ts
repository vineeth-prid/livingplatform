import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type {
  AssignedRole,
  AuthenticatedUser,
} from '../../common/types/authenticated-user';

export interface ResolvedAuthorization {
  roles: AssignedRole[];
  permissions: string[];
}

/**
 * Resolves the effective authorization for a user by aggregating every role
 * assignment (and each role's granted permissions) into a flat set. This is
 * the single place that turns DB rows into the roles/permissions embedded in
 * the access token — keeping guards free of database access.
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveAuthorization(userId: string): Promise<ResolvedAuthorization> {
    const assignments = await this.prisma.userRole.findMany({
      where: { user: { id: userId, deletedAt: null } },
      select: {
        communityId: true,
        role: {
          select: {
            key: true,
            scope: true,
            permissions: {
              select: { permission: { select: { key: true } } },
            },
          },
        },
      },
    });

    const roles: AssignedRole[] = [];
    const permissions = new Set<string>();

    for (const a of assignments) {
      roles.push({
        key: a.role.key,
        scope: a.role.scope,
        communityId: a.communityId,
      });
      for (const rp of a.role.permissions) {
        permissions.add(rp.permission.key);
      }
    }

    return { roles, permissions: [...permissions] };
  }

  /** Builds the full authenticated principal (used when minting tokens). */
  async buildPrincipal(user: {
    id: string;
    email: string;
    tenantId: string | null;
  }): Promise<AuthenticatedUser> {
    const { roles, permissions } = await this.resolveAuthorization(user.id);
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantIds: await this.reachableTenants(user.tenantId, roles),
      roles,
      permissions,
    };
  }

  /**
   * Every tenant this person can operate in: their home tenant plus the tenant
   * of each community they hold a grant in.
   *
   * A community is its own tenant here, so a supervisor covering three
   * communities, or an owner with flats in two, legitimately spans tenants. The
   * alternative was a separate login per community — duplicate humans in the
   * data and a password per gate.
   *
   * Authorization is unchanged and still per community; this only widens which
   * tenants their community grants are allowed to resolve inside.
   */
  private async reachableTenants(
    homeTenantId: string | null,
    roles: AssignedRole[],
  ): Promise<string[]> {
    const communityIds = [
      ...new Set(roles.map((r) => r.communityId).filter((id): id is string => !!id)),
    ];
    if (communityIds.length === 0) {
      return homeTenantId ? [homeTenantId] : [];
    }

    const communities = await this.prisma.community.findMany({
      where: { id: { in: communityIds }, deletedAt: null },
      select: { tenantId: true },
    });
    return [
      ...new Set([
        ...(homeTenantId ? [homeTenantId] : []),
        ...communities.map((c) => c.tenantId),
      ]),
    ];
  }

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        tenantId: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      select: {
        id: true,
        key: true,
        resource: true,
        action: true,
        description: true,
      },
    });
  }
}
