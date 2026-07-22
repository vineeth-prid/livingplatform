import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { MaintenancePlanService } from './maintenance-plan.service';

/** Read access to the immutable MaintenanceRun history. */
@Injectable()
export class MaintenanceRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly plans: MaintenancePlanService,
  ) {}

  async listByPlan(planId: string) {
    await this.plans.loadOrThrow(planId); // tenant-verified
    return this.prisma.maintenanceRun.findMany({
      where: { planId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string) {
    const run = await this.prisma.maintenanceRun.findUnique({
      where: { id },
      include: { plan: { select: { communityId: true, name: true } } },
    });
    if (!run) throw new NotFoundException('Maintenance run not found');
    await this.access.assert(run.plan.communityId);
    return run;
  }
}
