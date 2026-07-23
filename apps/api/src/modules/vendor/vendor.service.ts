import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { AccountProvisioningService } from '../people/account-provisioning.service';
import { UserLinkService } from '../people/user-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import {
  CreateVendorDto,
  QueryVendorDto,
  UpdateVendorDto,
} from './dto/vendor.dto';

const SORTABLE = ['name', 'companyName', 'category', 'createdAt', 'status'] as const;

/**
 * Vendors are TENANT-scoped (they cover many communities within a tenant), so
 * isolation is enforced on `tenantId` here rather than through
 * CommunityAccessService. Coverage is a denormalized `communityIds[]`.
 */
@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly userLink: UserLinkService,
    private readonly accounts: AccountProvisioningService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateVendorDto, actor: AuthenticatedUser) {
    const tenantId = this.tenant.isPlatform ? dto.tenantId : this.tenant.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'A Platform Admin must specify tenantId when creating a vendor',
      );
    }
    if (dto.userId) await this.userLink.assertLinkable(dto.userId, tenantId);

    // Vendor login: username = phone, common one-time password (tenant-scoped role).
    const userId = dto.userId ?? (await this.accounts.provisionLogin({
      kind: 'vendor',
      tenantId,
      communityId: null,
      phone: dto.phone,
      firstName: dto.name,
      lastName: dto.companyName ?? '',
      email: dto.email,
      actorId: actor.id,
    }));

    const code = dto.code ?? (await this.nextVendorCode(tenantId));

    const vendor = await this.prisma.vendor.create({
      data: {
        tenantId,
        userId,
        code,
        name: dto.name,
        companyName: dto.companyName,
        category: dto.category,
        serviceCategories: dto.serviceCategories ?? [],
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        city: dto.city,
        communityIds: dto.communityIds ?? [],
        status: dto.status ?? 'ACTIVE',
        remarks: dto.remarks,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.VendorCreated,
      ...this.events.from(actor, null),
      entityId: vendor.id,
      data: { name: vendor.name, category: vendor.category },
    });
    return vendor;
  }

  async findMany(query: QueryVendorDto): Promise<Paginated<unknown>> {
    const where: Prisma.VendorWhereInput = {
      deletedAt: null,
      ...this.tenantWhere(),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.communityId ? { communityIds: { has: query.communityId } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    this.assertTenant(vendor.tenantId);
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto, actor: AuthenticatedUser) {
    const vendor = await this.findOne(id);
    if (dto.userId) {
      await this.userLink.assertLinkable(dto.userId, vendor.tenantId, {
        kind: 'vendor',
        id,
      });
    }
    return this.prisma.vendor.update({
      where: { id },
      data: {
        userId: dto.userId,
        code: dto.code,
        name: dto.name,
        companyName: dto.companyName,
        category: dto.category,
        serviceCategories: dto.serviceCategories,
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        city: dto.city,
        communityIds: dto.communityIds,
        status: dto.status,
        remarks: dto.remarks,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  /** Sequential per-tenant code: V-000001, V-000002, … */
  private async nextVendorCode(tenantId: string): Promise<string> {
    const count = await this.prisma.vendor.count({ where: { tenantId } });
    return `V-${String(count + 1).padStart(6, '0')}`;
  }

  private tenantWhere(): Prisma.VendorWhereInput {
    if (this.tenant.isPlatform) return {};
    return { tenantId: this.tenant.tenantId ?? '__no_tenant__' };
  }

  private assertTenant(tenantId: string): void {
    if (!this.tenant.isPlatform && tenantId !== this.tenant.tenantId) {
      throw new NotFoundException('Vendor not found');
    }
  }
}
