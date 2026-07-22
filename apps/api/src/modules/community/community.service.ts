import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { slugify } from '../../common/utils/slug';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { QueryCommunityDto } from './dto/query-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

const SORTABLE = ['name', 'code', 'createdAt', 'status', 'type'] as const;

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateCommunityDto, actor: AuthenticatedUser) {
    const tenantId = this.tenant.isPlatform ? dto.tenantId : this.tenant.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'A Platform Admin must specify tenantId when creating a community',
      );
    }

    const created = await this.prisma.community.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        slug: dto.slug ? slugify(dto.slug) : slugify(dto.name),
        description: dto.description,
        type: dto.type,
        status: dto.status ?? 'ONBOARDING',
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        district: dto.district,
        pincode: dto.pincode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        logoKey: dto.logoKey,
        coverImageKey: dto.coverImageKey,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        emergencyContacts: dto.emergencyContacts as unknown as
          | Prisma.InputJsonValue
          | undefined,
        builderName: dto.builderName,
        associationName: dto.associationName,
        registrationNumber: dto.registrationNumber,
        goLiveDate: dto.goLiveDate,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue,
        createdById: actor.id,
        updatedById: actor.id,
        // Every community gets a settings row so the UI always has a target.
        settings: { create: {} },
      },
    });

    this.events.publish({
      name: DomainEventName.CommunityCreated,
      ...this.events.from(actor, created.id),
      entityId: created.id,
      data: { name: created.name, code: created.code },
    });

    return this.present(created);
  }

  async findMany(query: QueryCommunityDto): Promise<Paginated<unknown>> {
    const where: Prisma.CommunityWhereInput = {
      deletedAt: null,
      ...this.access.tenantWhere(),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.community.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.community.count({ where }),
    ]);

    return paginate(rows.map((c) => this.present(c)), total, query);
  }

  async findOne(id: string) {
    await this.access.assert(id);
    const community = await this.prisma.community.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: true,
        _count: {
          select: {
            phases: { where: { deletedAt: null } },
            blocks: { where: { deletedAt: null } },
            units: { where: { deletedAt: null } },
            amenities: { where: { deletedAt: null } },
            documents: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!community) throw new NotFoundException('Community not found');
    return {
      ...this.present(community),
      settings: community.settings,
      statistics: {
        phases: community._count.phases,
        blocks: community._count.blocks,
        units: community._count.units,
        amenities: community._count.amenities,
        documents: community._count.documents,
      },
    };
  }

  async update(id: string, dto: UpdateCommunityDto, actor: AuthenticatedUser) {
    await this.access.assert(id);
    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        slug: dto.slug ? slugify(dto.slug) : undefined,
        description: dto.description,
        type: dto.type,
        status: dto.status,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        district: dto.district,
        pincode: dto.pincode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        timezone: dto.timezone,
        logoKey: dto.logoKey,
        coverImageKey: dto.coverImageKey,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        emergencyContacts: dto.emergencyContacts as unknown as
          | Prisma.InputJsonValue
          | undefined,
        builderName: dto.builderName,
        associationName: dto.associationName,
        registrationNumber: dto.registrationNumber,
        goLiveDate: dto.goLiveDate,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });

    this.events.publish({
      name: DomainEventName.CommunityUpdated,
      ...this.events.from(actor, updated.id),
      entityId: updated.id,
      data: { name: updated.name, code: updated.code },
    });
    return this.present(updated);
  }

  async archive(id: string, actor: AuthenticatedUser) {
    await this.access.assert(id);
    const archived = await this.prisma.community.update({
      where: { id },
      data: { status: 'ARCHIVED', updatedById: actor.id },
    });
    this.events.publish({
      name: DomainEventName.CommunityArchived,
      ...this.events.from(actor, archived.id),
      entityId: archived.id,
      data: { name: archived.name, code: archived.code },
    });
    return this.present(archived);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.access.assert(id);
    await this.prisma.community.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  /** Adds resolved asset URLs to a community row. */
  private present<T extends { logoKey: string | null; coverImageKey: string | null }>(
    community: T,
  ) {
    return {
      ...community,
      logoUrl: this.storage.resolveUrl(community.logoKey),
      coverImageUrl: this.storage.resolveUrl(community.coverImageKey),
    };
  }
}
