import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AnnouncementStatus, Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AnnouncementEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateAnnouncementDto, QueryAnnouncementDto, UpdateAnnouncementDto,
} from './dto/announcement.dto';

const SORTABLE = ['priority', 'publishAt', 'createdAt'] as const;
const A = AnnouncementStatus;

/** The publicly-visible window: published, publish time reached, not yet expired. */
export function visibleWhere(now: Date): Prisma.AnnouncementWhereInput {
  return {
    status: A.PUBLISHED,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  };
}

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateAnnouncementDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    this.assertDates(dto.publishAt, dto.expiresAt);
    return this.prisma.announcement.create({
      data: {
        tenantId: community.tenantId,
        communityId: dto.communityId,
        title: dto.title,
        content: dto.content,
        priority: dto.priority ?? 'NORMAL',
        publishAt: dto.publishAt,
        expiresAt: dto.expiresAt,
        status: A.DRAFT,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  async findMany(query: QueryAnnouncementDto, actor: AuthenticatedUser): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const canManage = actor.permissions.includes(PERMISSIONS.ANNOUNCEMENT_UPDATE);
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(query.priority ? { priority: query.priority } : {}),
      // Residents (no manage permission) only ever see currently-visible items.
      ...(!canManage
        ? visibleWhere(now)
        : query.publishedOnly ? visibleWhere(now) : query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where, orderBy: resolveSort(query, SORTABLE, 'publishAt'), skip: query.skip, take: query.take,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const announcement = await this.loadOrThrow(id);
    if (!actor.permissions.includes(PERMISSIONS.ANNOUNCEMENT_UPDATE)) {
      const now = new Date();
      const visible = announcement.status === A.PUBLISHED
        && (!announcement.publishAt || announcement.publishAt <= now)
        && (!announcement.expiresAt || announcement.expiresAt > now);
      if (!visible) throw new ForbiddenException('This announcement is not available');
    }
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto, actor: AuthenticatedUser) {
    const announcement = await this.loadOrThrow(id);
    this.assertDates(dto.publishAt ?? announcement.publishAt, dto.expiresAt ?? announcement.expiresAt);
    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        priority: dto.priority,
        publishAt: dto.publishAt,
        expiresAt: dto.expiresAt,
        updatedById: actor.id,
      },
    });
  }

  async publish(id: string, actor: AuthenticatedUser) {
    const announcement = await this.loadOrThrow(id);
    if (announcement.status === A.PUBLISHED) throw new BadRequestException('Already published');
    const now = new Date();
    if (announcement.expiresAt && announcement.expiresAt <= now) {
      throw new BadRequestException('Cannot publish an announcement whose expiry has passed');
    }
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: A.PUBLISHED, publishAt: announcement.publishAt ?? now, updatedById: actor.id },
    });
    this.publishEvent(DomainEventName.AnnouncementPublished, updated, actor.id);
    return updated;
  }

  async expire(id: string, actor: AuthenticatedUser) {
    const announcement = await this.loadOrThrow(id);
    if (announcement.status === A.EXPIRED) throw new BadRequestException('Already expired');
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: A.EXPIRED, updatedById: actor.id },
    });
    this.publishEvent(DomainEventName.AnnouncementExpired, updated, actor.id);
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.loadOrThrow(id);
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actor.id } });
    return { id, deleted: true };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOrThrow(id: string) {
    const announcement = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.access.assert(announcement.communityId);
    return announcement;
  }

  private assertDates(publishAt?: Date | null, expiresAt?: Date | null) {
    if (publishAt && expiresAt && expiresAt.getTime() <= publishAt.getTime()) {
      throw new BadRequestException('expiresAt must be after publishAt');
    }
  }

  private publishEvent(
    name: AnnouncementEvent['name'],
    announcement: { id: string; communityId: string; tenantId: string; title: string; priority: string },
    actorId: string | null,
  ): void {
    const event = {
      name,
      tenantId: announcement.tenantId,
      communityId: announcement.communityId,
      actorId,
      entityId: announcement.id,
      data: { title: announcement.title, priority: announcement.priority },
    } satisfies Omit<AnnouncementEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
