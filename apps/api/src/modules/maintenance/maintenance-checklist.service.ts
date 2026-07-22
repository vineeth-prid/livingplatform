import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './dto/checklist.dto';
import { MaintenancePlanService } from './maintenance-plan.service';

/** Reusable checklist templates on a plan; snapshotted into generated work orders. */
@Injectable()
export class MaintenanceChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly plans: MaintenancePlanService,
  ) {}

  async add(planId: string, dto: CreateChecklistItemDto) {
    await this.plans.loadOrThrow(planId); // tenant-verified
    return this.prisma.maintenanceChecklistTemplate.create({
      data: {
        planId,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
        isMandatory: dto.isMandatory ?? true,
        instructions: dto.instructions,
      },
    });
  }

  async update(id: string, dto: UpdateChecklistItemDto) {
    await this.loadItemOrThrow(id);
    return this.prisma.maintenanceChecklistTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        sortOrder: dto.sortOrder,
        isMandatory: dto.isMandatory,
        instructions: dto.instructions,
      },
    });
  }

  async remove(id: string) {
    await this.loadItemOrThrow(id);
    await this.prisma.maintenanceChecklistTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  private async loadItemOrThrow(id: string) {
    const item = await this.prisma.maintenanceChecklistTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { plan: { select: { communityId: true, deletedAt: true } } },
    });
    if (!item || item.plan.deletedAt) throw new NotFoundException('Checklist item not found');
    await this.access.assert(item.plan.communityId);
    return item;
  }
}
