import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import {
  CreateTicketCategoryDto,
  QueryTicketCategoryDto,
  UpdateTicketCategoryDto,
} from './dto/category.dto';

/**
 * Configurable ticket categories. System defaults (tenantId = null) are visible
 * to every tenant; a tenant may add and manage its own. Only Platform Admins
 * touch system categories. The category carries the business context, keeping
 * the ticket engine generic.
 */
@Injectable()
export class TicketCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  list(query: QueryTicketCategoryDto) {
    return this.prisma.ticketCategory.findMany({
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

  async create(dto: CreateTicketCategoryDto) {
    // Platform admins may create system (tenantId null) or tenant categories;
    // everyone else creates only within their own tenant.
    const tenantId = this.tenant.isPlatform
      ? (dto.tenantId ?? null)
      : this.tenant.tenantId;
    return this.prisma.ticketCategory.create({
      data: {
        tenantId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        iconKey: dto.iconKey,
        isActive: dto.isActive ?? true,
        isSystem: tenantId === null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateTicketCategoryDto) {
    await this.load(id); // authorization: throws unless the caller may manage it
    return this.prisma.ticketCategory.update({
      where: { id },
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        iconKey: dto.iconKey,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string) {
    await this.load(id);
    await this.prisma.ticketCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  /** Ensure a category is usable by a ticket in `tenantId` (system or own, active). */
  async assertUsable(categoryId: string, tenantId: string) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('Category is not available for this community');
    }
  }

  /** Loads a category the caller is allowed to manage (own tenant, or system if platform). */
  private async load(id: string) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category.tenantId === null && !this.tenant.isPlatform) {
      throw new ForbiddenException('System categories are managed by the platform');
    }
    if (
      category.tenantId !== null &&
      !this.tenant.isPlatform &&
      category.tenantId !== this.tenant.tenantId
    ) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
