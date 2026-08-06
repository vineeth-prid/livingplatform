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

  /**
   * Edit a service.
   *
   * Editing a PLATFORM service from a community adopts it: the row is copied
   * into that tenant with the edits applied, and the original is withdrawn for
   * them alone via TenantServiceSetting. The community ends up owning an
   * ordinary service — rename it, reprice it, give it variants — while every
   * other community keeps the untouched default and past requests still resolve
   * the row they were booked against.
   */
  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!service) throw new NotFoundException('Service not found');

    if (service.tenantId === null && !this.tenant.isPlatform) {
      return this.adoptPlatformService(service, dto);
    }

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

  /** Copy a platform service into this tenant with the edits, and withdraw the original. */
  private async adoptPlatformService(
    service: {
      id: string; key: string; name: string; description: string | null;
      estimatedDurationMinutes: number | null; iconKey: string | null; color: string | null;
      isActive: boolean; sortOrder: number; basePrice: Prisma.Decimal | null;
    },
    dto: UpdateServiceDto,
  ) {
    const tenantId = this.tenant.tenantId;
    if (!tenantId) throw new ForbiddenException('No tenant context');

    return this.prisma.$transaction(async (tx) => {
      const key = dto.key ?? service.key;
      // An earlier adoption may already own this key — update rather than
      // collide with the tenant/key uniqueness.
      const existing = await tx.service.findFirst({ where: { tenantId, key, deletedAt: null } });

      const data = {
        key,
        name: dto.name ?? service.name,
        description: dto.description ?? service.description,
        estimatedDurationMinutes:
          dto.estimatedDurationMinutes ?? service.estimatedDurationMinutes,
        iconKey: dto.iconKey ?? service.iconKey,
        color: dto.color ?? service.color,
        isActive: dto.isActive ?? service.isActive,
        sortOrder: dto.sortOrder ?? service.sortOrder,
        basePrice: dto.basePrice ?? service.basePrice,
      };

      const owned = existing
        ? await tx.service.update({ where: { id: existing.id }, data })
        : await tx.service.create({ data: { ...data, tenantId } });

      await tx.tenantServiceSetting.upsert({
        where: { tenantId_serviceId: { tenantId, serviceId: service.id } },
        create: { tenantId, serviceId: service.id, isActive: false },
        update: { isActive: false },
      });

      return owned;
    });
  }

  /**
   * Replace a service's priced options in one call.
   *
   * A whole-list replace rather than per-variant CRUD: an admin edits them as a
   * set ("Hatchback / Sedan / SUV"), and three endpoints to express one intent
   * would be worse for both sides.
   *
   * Removed variants are DEACTIVATED, never hard-deleted — an existing request
   * must keep resolving the option name and price it was booked under.
   */
  async setVariants(
    id: string,
    variants: { id?: string; name: string; price: number; durationMinutes?: number | null }[],
  ) {
    await this.load(id);

    const existing = await this.prisma.serviceVariant.findMany({
      where: { serviceId: id, deletedAt: null },
      select: { id: true },
    });
    const keep = new Set(variants.map((v) => v.id).filter((v): v is string => !!v));
    const dropped = existing.filter((v) => !keep.has(v.id)).map((v) => v.id);

    await this.prisma.$transaction([
      ...(dropped.length
        ? [
            this.prisma.serviceVariant.updateMany({
              where: { id: { in: dropped } },
              data: { isActive: false, deletedAt: new Date() },
            }),
          ]
        : []),
      ...variants.map((v, index) =>
        v.id
          ? this.prisma.serviceVariant.update({
              where: { id: v.id },
              data: {
                name: v.name.trim(),
                price: v.price,
                durationMinutes: v.durationMinutes ?? null,
                sortOrder: index,
                isActive: true,
              },
            })
          : this.prisma.serviceVariant.create({
              data: {
                serviceId: id,
                name: v.name.trim(),
                price: v.price,
                durationMinutes: v.durationMinutes ?? null,
                sortOrder: index,
              },
            }),
      ),
    ]);

    return this.prisma.serviceVariant.findMany({
      where: { serviceId: id, deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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
   * May the caller EDIT or DELETE this row directly?
   *
   * A platform row is shared with every other tenant, so it is never mutated in
   * place by a community. That is not a refusal any more: `update` adopts the
   * service into the tenant first and edits the copy, and `setStatus` withdraws
   * it through TenantServiceSetting. This guard is what remains for the paths
   * with no adopt equivalent — deletion.
   */
  private assertOwned(service: { tenantId: string | null }): void {
    if (this.tenant.isPlatform) return;
    if (service.tenantId === null) {
      throw new ForbiddenException(
        'A platform service cannot be deleted. Switch it off to withdraw it from your catalog — ' +
          'editing it gives your community its own copy automatically.',
      );
    }
    if (service.tenantId !== this.tenant.tenantId) {
      throw new NotFoundException('Service not found');
    }
  }
}
