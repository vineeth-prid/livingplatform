import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import {
  paginate,
  type Paginated,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  tenantId: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * User administration, scoped to the caller's tenant. A Platform Admin sees
 * every user; everyone else is confined to their own tenant — the core
 * multi-tenant isolation rule, enforced here rather than trusted to callers.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  /** Restricts a query to the caller's tenant unless they are platform-level. */
  private tenantScope(): Prisma.UserWhereInput {
    if (this.tenant.isPlatform) return {};
    return { tenantId: this.tenant.tenantId };
  }

  async findMany(query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.UserWhereInput = { deletedAt: null, ...this.tenantScope() };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.tenantScope() },
      select: {
        ...PUBLIC_SELECT,
        roles: {
          select: {
            communityId: true,
            role: { select: { key: true, name: true, scope: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateStatus(id: string, status: UserStatus) {
    // Ensure the target is visible within the caller's tenant first.
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: PUBLIC_SELECT,
    });
  }
}
