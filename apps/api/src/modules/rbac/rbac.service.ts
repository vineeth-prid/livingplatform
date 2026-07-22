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
      roles,
      permissions,
    };
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
