import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { CreateGateDto } from './dto/gate-entry.dto';

/**
 * The community's physical gates. Intentionally minimal: a gate is a label on
 * an entry, and most communities will only ever have one. Entries survive a
 * gate being removed (the FK is SET NULL), so deleting one is never destructive.
 */
@Injectable()
export class GateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
  ) {}

  async findMany(communityId: string) {
    await this.access.assert(communityId);
    return this.prisma.gate.findMany({
      where: { communityId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(communityId: string, dto: CreateGateDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    return this.prisma.gate.create({
      data: {
        communityId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  async update(communityId: string, id: string, dto: CreateGateDto, actor: AuthenticatedUser) {
    await this.assertOwned(communityId, id);
    return this.prisma.gate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        updatedById: actor.id,
      },
    });
  }

  async remove(communityId: string, id: string, actor: AuthenticatedUser) {
    await this.assertOwned(communityId, id);
    await this.prisma.gate.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  private async assertOwned(communityId: string, id: string): Promise<void> {
    await this.access.assert(communityId);
    const gate = await this.prisma.gate.findFirst({
      where: { id, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!gate) throw new NotFoundException('Gate not found');
  }
}
