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

  list(query: QueryServiceDto) {
    const scope = this.tenant.isPlatform
      ? []
      : [{ OR: [{ tenantId: null }, { tenantId: this.tenant.tenantId }] }];
    return this.prisma.service.findMany({
      where: {
        deletedAt: null,
        ...(query.activeOnly ? { isActive: true } : {}),
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
    });
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
    await this.load(id);
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
      select: { id: true },
    });
    if (!service) {
      throw new BadRequestException('Service is not available for this community');
    }
  }

  private async load(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (service.tenantId === null && !this.tenant.isPlatform) {
      throw new ForbiddenException('System services are managed by the platform');
    }
    if (
      service.tenantId !== null &&
      !this.tenant.isPlatform &&
      service.tenantId !== this.tenant.tenantId
    ) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }
}
