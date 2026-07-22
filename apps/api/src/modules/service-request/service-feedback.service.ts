import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceRequestStatus } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import type { ServiceRequestEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { SubmitFeedbackDto } from './dto/feedback.dto';
import { formatServiceRequestNumber } from './service-request.service';

/**
 * Resident feedback — a 1–5 rating + optional comment, allowed ONLY after the
 * request is completed. Idempotent (upsert), so a resident may revise it.
 */
@Injectable()
export class ServiceFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async submit(serviceRequestId: string, dto: SubmitFeedbackDto, actor: AuthenticatedUser) {
    const request = await this.loadRequest(serviceRequestId);
    if (request.status !== ServiceRequestStatus.COMPLETED) {
      throw new BadRequestException('Feedback can only be submitted after completion');
    }

    const feedback = await this.prisma.serviceFeedback.upsert({
      where: { serviceRequestId },
      create: {
        serviceRequestId,
        rating: dto.rating,
        comment: dto.comment,
        createdById: actor.id,
      },
      update: { rating: dto.rating, comment: dto.comment },
    });

    const event = {
      name: DomainEventName.FeedbackSubmitted,
      ...this.events.from(actor, request.communityId),
      entityId: serviceRequestId,
      data: {
        requestNumber: formatServiceRequestNumber(request.number),
        rating: dto.rating,
      },
    } satisfies Omit<ServiceRequestEvent, 'occurredAt'>;
    this.events.publish(event);

    return feedback;
  }

  async get(serviceRequestId: string) {
    await this.loadRequest(serviceRequestId);
    return this.prisma.serviceFeedback.findUnique({ where: { serviceRequestId } });
  }

  private async loadRequest(id: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, communityId: true, number: true, status: true },
    });
    if (!request) throw new NotFoundException('Service request not found');
    await this.access.assert(request.communityId);
    return request;
  }
}
