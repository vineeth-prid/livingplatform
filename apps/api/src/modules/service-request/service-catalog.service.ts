import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, ServiceRequestStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import {
  CreateServiceDto,
  QueryServiceDto,
  UpdateServiceDto,
} from './dto/service.dto';

/**
 * The configurable service catalog. System defaults (tenantId = null) are
 * visible to every tenant; a tenant may add and manage its own. Same
 * system/tenant pattern as ticket categories.
 */
@Injectable()
export class ServiceCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  /**
   * The catalog as THIS tenant sees it.
   *
   * A platform service is one row shared by every tenant, so a tenant's decision
   * to withdraw it lives in `TenantServiceSetting` rather than on the row —
   * otherwise one community deactivating "Deep clean" would remove it for all of
   * them. The override is folded in here so every caller (portal, vendor form,
   * resident app) sees the same effective list without knowing about it.
   */
  async list(query: QueryServiceDto) {
    const tenantId = this.tenant.tenantId;
    const scope = this.tenant.isPlatform
      ? []
      : [{ OR: [{ tenantId: null }, { tenantId }] }];

    const services = await this.prisma.service.findMany({
      where: {
        deletedAt: null,
        AND: [
          ...scope,
          ...(query.search
            ? [
                {
                  OR: [
                    { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                    { key: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      // Variants ride along: the resident app needs them to render the option
      // picker, and a second round-trip per service tile would be absurd.
      include: {
        variants: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    // Platform callers see the raw rows — there is no single tenant to resolve
    // an override against.
    if (this.tenant.isPlatform || !tenantId) {
      return query.activeOnly ? services.filter((s) => s.isActive) : services;
    }

    const overrides = await this.prisma.tenantServiceSetting.findMany({
      where: { tenantId, serviceId: { in: services.map((s) => s.id) } },
    });
    const byService = new Map(overrides.map((o) => [o.serviceId, o]));

    const effective = services.map((service) => {
      const override = byService.get(service.id);
      return {
        ...service,
        // A tenant override only ever applies to a platform service; a
        // tenant-owned row is authoritative about itself.
        isActive: service.tenantId === null && override ? override.isActive : service.isActive,
        sortOrder: override?.sortOrder ?? service.sortOrder,
      };
    });

    const filtered = query.activeOnly ? effective.filter((s) => s.isActive) : effective;
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  /**
   * Enable / disable a service.
   *
   * This — not deletion — is how a community stops offering something. An
   * inactive service disappears from the resident app (`activeOnly`) and can no
   * longer be requested (`assertUsable` requires `isActive`), while every
   * historical request keeps pointing at it and existing in-flight work is
   * untouched. Nothing is lost, and no report develops a hole.
   */
  async setStatus(id: string, isActive: boolean) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    // A tenant withdrawing a PLATFORM service records it against their own
    // tenant instead of mutating the shared row — otherwise one community
    // deactivating a service would withdraw it from every other community too.
    if (service.tenantId === null && !this.tenant.isPlatform) {
      const tenantId = this.tenant.tenantId;
      if (!tenantId) throw new ForbiddenException('No tenant context');
      await this.prisma.tenantServiceSetting.upsert({
        where: { tenantId_serviceId: { tenantId, serviceId: id } },
        create: { tenantId, serviceId: id, isActive },
        update: { isActive },
      });
      return { ...service, isActive };
    }

    await this.assertOwned(service);
    return this.prisma.service.update({ where: { id }, data: { isActive } });
  }

  /** Where a service is still referenced — shown before disabling it. */
  async usage(id: string): Promise<{ openRequests: number; packages: number }> {
    const [openRequests, packages] = await Promise.all([
      this.prisma.serviceRequest.count({
        where: {
          serviceId: id,
          deletedAt: null,
          status: {
            in: [
              ServiceRequestStatus.REQUESTED,
              ServiceRequestStatus.ASSIGNED,
              ServiceRequestStatus.ACCEPTED,
              ServiceRequestStatus.SCHEDULED,
              ServiceRequestStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      this.prisma.servicePackageItem.count({ where: { serviceId: id } }),
    ]);
    return { openRequests, packages };
  }

  create(dto: CreateServiceDto) {
    const tenantId = this.tenant.isPlatform
      ? (dto.tenantId ?? null)
      : this.tenant.tenantId;
    return this.prisma.service.create({
      data: {
        tenantId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        iconKey: dto.iconKey,
        color: dto.color,
        isActive: dto.isActive ?? true,
        isSystem: tenantId === null,
        sortOrder: dto.sortOrder ?? 0,
        basePrice: dto.basePrice,
      },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.load(id); // authorization: throws unless the caller may manage it
    return this.prisma.service.update({
      where: { id },
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        iconKey: dto.iconKey,
        color: dto.color,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        basePrice: dto.basePrice,
      },
    });
  }

  async remove(id: string) {
    await this.load(id);
    await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  /** Ensure a service is usable by a request in `tenantId` (system or own, active). */
  async assertUsable(serviceId: string, tenantId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        deletedAt: null,
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      select: { id: true, tenantId: true },
    });
    if (!service) {
      throw new BadRequestException('Service is not available for this community');
    }

    // A platform service this tenant has withdrawn must be unrequestable, or
    // hiding it in the catalog would be cosmetic only — a stale client (or a
    // direct API call) could still book it.
    if (service.tenantId === null) {
      const override = await this.prisma.tenantServiceSetting.findUnique({
        where: { tenantId_serviceId: { tenantId, serviceId } },
        select: { isActive: true },
      });
      if (override && !override.isActive) {
        throw new BadRequestException('Service is not available for this community');
      }
    }
  }

  private async load(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');
    await this.assertOwned(service);
    return service;
  }

  /**
   * May the caller EDIT or DELETE this row?
   *
   * Editing a platform service is still refused: the row is shared with every
   * other tenant, so a rename or price change here would reach communities that
   * never asked for it. Withdrawing it is a different question and is handled by
   * `setStatus` through TenantServiceSetting — an admin who wants their own
   * version copies it by creating a community service.
   */
  private assertOwned(service: { tenantId: string | null }): void {
    if (this.tenant.isPlatform) return;
    if (service.tenantId === null) {
      throw new ForbiddenException(
        'A platform service cannot be edited or deleted. Deactivate it to withdraw it from your ' +
          'catalog, or create your own community service.',
      );
    }
    if (service.tenantId !== this.tenant.tenantId) {
      throw new NotFoundException('Service not found');
    }
  }
}
