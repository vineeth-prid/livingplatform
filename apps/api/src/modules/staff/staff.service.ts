import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { AccountProvisioningService } from '../people/account-provisioning.service';
import { UserLinkService } from '../people/user-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateStaffDto,
  QueryStaffDto,
  UpdateStaffDto,
} from './dto/staff.dto';

const SORTABLE = ['firstName', 'lastName', 'employeeId', 'role', 'createdAt', 'status'] as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly userLink: UserLinkService,
    private readonly accounts: AccountProvisioningService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateStaffDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);
    if (dto.userId) {
      await this.userLink.assertLinkable(dto.userId, community.tenantId);
    }

    const userId = dto.userId ?? (await this.accounts.provisionLogin({
      kind: 'staff',
      tenantId: community.tenantId,
      communityId,
      phone: dto.phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      actorId: actor.id,
    }));
    const employeeId = dto.employeeId ?? (await this.nextEmployeeId(communityId));

    const staff = await this.prisma.staff.create({
      data: {
        communityId,
        userId,
        employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        department: dto.department,
        phone: dto.phone,
        email: dto.email,
        photoKey: dto.photoKey,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.StaffCreated,
      ...this.events.from(actor, communityId),
      entityId: staff.id,
      data: { employeeId: staff.employeeId, role: staff.role },
    });
    return this.present(staff);
  }

  async findMany(communityId: string, query: QueryStaffDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.StaffWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { employeeId: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staff.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.staff.count({ where }),
    ]);
    return paginate(items.map((s) => this.present(s)), total, query);
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    await this.access.assert(staff.communityId);
    return this.present(staff);
  }

  async update(id: string, dto: UpdateStaffDto, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);
    if (dto.userId) {
      const community = await this.access.assert(existing.communityId);
      await this.userLink.assertLinkable(dto.userId, community.tenantId, {
        kind: 'staff',
        id,
      });
    }
    const staff = await this.prisma.staff.update({
      where: { id },
      data: {
        userId: dto.userId,
        employeeId: dto.employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        department: dto.department,
        phone: dto.phone,
        email: dto.email,
        photoKey: dto.photoKey,
        status: dto.status,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
    return this.present(staff);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.staff.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  private async nextEmployeeId(communityId: string): Promise<string> {
    const count = await this.prisma.staff.count({ where: { communityId } });
    return `EMP-${String(count + 1).padStart(4, '0')}`;
  }

  private present<T extends { photoKey: string | null }>(staff: T) {
    return { ...staff, photoUrl: this.storage.resolveUrl(staff.photoKey) };
  }
}
