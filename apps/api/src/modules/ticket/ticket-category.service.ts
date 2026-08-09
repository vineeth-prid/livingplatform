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

  /**
   * The categories this caller can use, with the tenant's own on/off decision
   * folded in.
   *
   * A community switching a system default off records that against its own
   * tenant, so the effective `isActive` here is the override where one exists
   * and the shared row's value otherwise. Every caller — portal, staff picker,
   * resident app — sees the same effective list without knowing about it.
   */
  async list(query: QueryTicketCategoryDto) {
    const tenantId = this.tenant.tenantId;
    const categories = await this.prisma.ticketCategory.findMany({
      where: {
        deletedAt: null,
        ...(this.tenant.isPlatform
          ? {}
          : { OR: [{ tenantId: null }, { tenantId }] }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    if (this.tenant.isPlatform || !tenantId) {
      return query.activeOnly ? categories.filter((c) => c.isActive) : categories;
    }

    const overrides = await this.prisma.tenantCategorySetting.findMany({
      where: { tenantId, categoryId: { in: categories.map((c) => c.id) } },
      select: { categoryId: true, isActive: true },
    });
    const byId = new Map(overrides.map((o) => [o.categoryId, o.isActive]));

    const effective = categories.map((c) => ({ ...c, isActive: byId.get(c.id) ?? c.isActive }));
    return query.activeOnly ? effective.filter((c) => c.isActive) : effective;
  }

  /**
   * Turn a category on or off for this community.
   *
   * Categories are the community's vocabulary, so this is theirs to decide even
   * for a platform default — but a default is switched off through an override,
   * never by mutating the shared row, or one community hiding "Carpentry" would
   * remove it from every other community.
   */
  async setStatus(id: string, isActive: boolean) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category.tenantId === null && !this.tenant.isPlatform) {
      const tenantId = this.tenant.tenantId;
      if (!tenantId) throw new ForbiddenException('No tenant context');
      await this.prisma.tenantCategorySetting.upsert({
        where: { tenantId_categoryId: { tenantId, categoryId: id } },
        create: { tenantId, categoryId: id, isActive },
        update: { isActive },
      });
      return { ...category, isActive };
    }

    await this.load(id);
    return this.prisma.ticketCategory.update({ where: { id }, data: { isActive } });
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

  /**
   * Edit a category.
   *
   * Editing a SYSTEM default from a community adopts it: the row is copied into
   * that tenant with the edits applied, and the original is switched off for
   * them alone. They end up owning an ordinary category they can change freely,
   * every other community keeps the untouched default, and existing tickets
   * keep pointing at the row they were raised against.
   */
  async update(id: string, dto: UpdateTicketCategoryDto) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category.tenantId === null && !this.tenant.isPlatform) {
      return this.adoptSystemCategory(category, dto);
    }

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

  /** Copy a system default into this tenant with the edits, and hide the original. */
  private async adoptSystemCategory(
    category: { id: string; key: string; name: string; description: string | null; color: string | null; iconKey: string | null; isActive: boolean; sortOrder: number },
    dto: UpdateTicketCategoryDto,
  ) {
    const tenantId = this.tenant.tenantId;
    if (!tenantId) throw new ForbiddenException('No tenant context');

    return this.prisma.$transaction(async (tx) => {
      // The tenant may already own a category on this key from an earlier edit —
      // update it rather than colliding with @@unique([tenantId, key]).
      const key = dto.key ?? category.key;
      const existing = await tx.ticketCategory.findFirst({
        where: { tenantId, key, deletedAt: null },
      });

      const data = {
        key,
        name: dto.name ?? category.name,
        description: dto.description ?? category.description,
        color: dto.color ?? category.color,
        iconKey: dto.iconKey ?? category.iconKey,
        isActive: dto.isActive ?? category.isActive,
        sortOrder: dto.sortOrder ?? category.sortOrder,
      };

      const owned = existing
        ? await tx.ticketCategory.update({ where: { id: existing.id }, data })
        : await tx.ticketCategory.create({
            data: { ...data, tenantId, isSystem: false },
          });

      await tx.tenantCategorySetting.upsert({
        where: { tenantId_categoryId: { tenantId, categoryId: category.id } },
        create: { tenantId, categoryId: category.id, isActive: false },
        update: { isActive: false },
      });

      return owned;
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
      select: { id: true, tenantId: true },
    });
    if (!category) {
      throw new BadRequestException('Category is not available for this community');
    }
    // A system default this tenant switched off is not available to them, even
    // though the shared row is still active for everyone else.
    if (category.tenantId === null) {
      const override = await this.prisma.tenantCategorySetting.findUnique({
        where: { tenantId_categoryId: { tenantId, categoryId } },
        select: { isActive: true },
      });
      if (override && !override.isActive) {
        throw new BadRequestException('Category is not available for this community');
      }
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
    // Any tenant the caller can reach; they may hold communities in several.
    if (category.tenantId !== null && !this.tenant.canAccessTenant(category.tenantId)) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
