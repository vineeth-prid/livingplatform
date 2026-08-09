import {
  BadRequestException,
  Logger,
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
  private readonly logger = new Logger(VendorService.name);

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
        // Derived when the form no longer collects it — a vendor's primary
        // category is simply the first service they cover.
        category: dto.category ?? dto.serviceCategories?.[0] ?? 'GENERAL',
        serviceCategories: dto.serviceCategories ?? [],
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        city: dto.city,
        // Coverage decides everything downstream — auto-assignment, manual
        // assignment and AMCs all filter on it. A vendor created with an empty
        // list is inert: they appear in the register and can be assigned to
        // nothing, which is exactly how they were being created.
        communityIds: await this.resolveCoverage(dto.communityIds, actor),
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

  /**
   * The caller's OWN vendor record(s). Self-service and permission-free for the
   * same reason as `/staff/me`: the VENDOR role holds no `vendor:read`, yet a
   * vendor must be able to resolve their own profile to see their assigned
   * work. Scoped by `userId = caller`.
   */
  async findMine(user: AuthenticatedUser) {
    const vendors = await this.prisma.vendor.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return { items: vendors };
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
    // The mobile is the login username — move the account before saving, so a
    // clash fails the edit instead of stranding the vendor on a number they
    // cannot sign in with.
    if (dto.phone) {
      await this.accounts.syncLoginPhone({
        userId: vendor.userId,
        oldPhone: vendor.phone,
        newPhone: dto.phone,
        actorId: actor.id,
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

  /**
   * Create the login this vendor never got. Same gap as staff: provisioning
   * links an account to the FIRST profile on a phone number, leaving any later
   * one unable to sign in with nothing in the portal able to fix it.
   */
  async createLogin(id: string, actor: AuthenticatedUser) {
    const vendor = await this.findOne(id);
    if (vendor.userId) {
      throw new BadRequestException('This vendor already has a login — reset it instead');
    }
    const result = await this.accounts.provisionMissingLogin({
      kind: 'vendor',
      tenantId: vendor.tenantId,
      communityId: null,
      phone: vendor.phone,
      firstName: vendor.name,
      lastName: vendor.companyName ?? '',
      email: vendor.email,
      actorId: actor.id,
    });
    await this.prisma.vendor.update({
      where: { id },
      data: { userId: result.userId, updatedById: actor.id },
    });
    return {
      userId: result.userId,
      username: vendor.phone,
      temporaryPassword: result.temporaryPassword,
    };
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
  /**
   * Which communities a new vendor covers.
   *
   * An explicit list always wins. When none is given — the portal form did not
   * send one, so this was every vendor — fall back to the tenant's communities
   * rather than storing an empty array. An empty array is not "all", it is
   * "none": the vendor is created, listed, and then rejected by every
   * assignment path with "vendor does not cover this community".
   *
   * A single-community tenant is the common case and lands exactly where the
   * admin expects. Coverage stays editable afterwards.
   */
  private async resolveCoverage(
    explicit: string[] | undefined,
    actor: AuthenticatedUser,
  ): Promise<string[]> {
    if (explicit?.length) return explicit;

    const tenantId = this.tenant.isPlatform ? null : this.tenant.tenantId;
    if (!tenantId) return [];

    const communities = await this.prisma.community.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    if (communities.length === 0) {
      this.logger.warn(`Vendor created by ${actor.id} with no community coverage`);
    }
    return communities.map((c) => c.id);
  }

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
