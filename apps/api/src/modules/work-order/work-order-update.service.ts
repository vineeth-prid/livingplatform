import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkOrderEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import type { WorkOrderEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { CreateWorkOrderUpdateDto } from './dto/update.dto';
import { WorkOrderTimelineService } from './work-order-timeline.service';
import { formatWorkOrderNumber } from './work-order.service';

/** Progress updates on a work order (comment + optional progress %). */
@Injectable()
export class WorkOrderUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly timeline: WorkOrderTimelineService,
    private readonly events: DomainEventsService,
  ) {}

  async list(workOrderId: string, actor: AuthenticatedUser) {
    await this.assertAccess(workOrderId);
    const canSeeInternal = actor.permissions.includes(PERMISSIONS.WORKORDER_UPDATE);
    return this.prisma.workOrderUpdate.findMany({
      where: {
        workOrderId,
        deletedAt: null,
        ...(canSeeInternal ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(workOrderId: string, dto: CreateWorkOrderUpdateDto, actor: AuthenticatedUser) {
    const workOrder = await this.assertAccess(workOrderId);
    const update = await this.prisma.workOrderUpdate.create({
      data: {
        workOrderId,
        authorId: actor.id,
        comment: dto.comment,
        progressPercent: dto.progressPercent,
        isInternal: dto.isInternal ?? false,
      },
    });
    await this.timeline.record({
      workOrderId,
      type: WorkOrderEventType.PROGRESS_UPDATED,
      actorId: actor.id,
      reference: update.id,
      metadata:
        dto.progressPercent !== undefined
          ? { progressPercent: dto.progressPercent }
          : undefined,
    });
    const event = {
      name: DomainEventName.ProgressUpdated,
      ...this.events.from(actor, workOrder.communityId),
      entityId: workOrderId,
      data: {
        workOrderNumber: formatWorkOrderNumber(workOrder.number),
        ...(dto.progressPercent !== undefined ? { progressPercent: dto.progressPercent } : {}),
      },
    } satisfies Omit<WorkOrderEvent, 'occurredAt'>;
    this.events.publish(event);
    return update;
  }

  private async assertAccess(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, deletedAt: null },
      select: { id: true, communityId: true, number: true },
    });
    if (!workOrder) throw new NotFoundException('Work order not found');
    await this.access.assert(workOrder.communityId);
    return workOrder;
  }
}
