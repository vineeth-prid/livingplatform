import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

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
    return this.prisma.service.findMany({
      where: {
        deletedAt: null,
        ...(query.activeOnly ? { isActive: true } : {}),
        ...(this.tenant.isPlatform
          ? {}
          : { OR: [{ tenantId: null }, { tenantId: this.tenant.tenantId }] }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
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
