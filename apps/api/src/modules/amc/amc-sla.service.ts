import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AMCContract, AMCEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AMCEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { AmcContractService } from './amc-contract.service';
import { AmcHistoryService } from './amc-history.service';
import { assertSlaConsistent } from './amc.util';
import { CreateSlaRuleDto, UpdateSlaRuleDto } from './dto/sla.dto';

/** Per-priority SLA rules on a contract (one rule per priority). */
@Injectable()
export class AmcSlaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: AmcContractService,
    private readonly events: DomainEventsService,
    private readonly history: AmcHistoryService,
  ) {}

  async add(contractId: string, dto: CreateSlaRuleDto, actor: AuthenticatedUser) {
    const contract = await this.contracts.loadOrThrow(contractId);
    assertSlaConsistent(dto);

    const existing = await this.prisma.aMCSLARule.findUnique({
      where: { contractId_priority: { contractId, priority: dto.priority } },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`An SLA rule for ${dto.priority} priority already exists`);

    const rule = await this.prisma.aMCSLARule.create({
      data: {
        contractId,
        priority: dto.priority,
        responseTimeMinutes: dto.responseTimeMinutes,
        resolutionTimeMinutes: dto.resolutionTimeMinutes,
        escalationAfterMinutes: dto.escalationAfterMinutes,
      },
    });
    await this.slaChanged(contract, actor, dto.priority);
    return rule;
  }

  async update(id: string, dto: UpdateSlaRuleDto, actor: AuthenticatedUser) {
    const { rule, contract } = await this.loadRuleOrThrow(id);
    assertSlaConsistent({
      responseTimeMinutes: dto.responseTimeMinutes ?? rule.responseTimeMinutes,
      resolutionTimeMinutes: dto.resolutionTimeMinutes ?? rule.resolutionTimeMinutes,
      escalationAfterMinutes: dto.escalationAfterMinutes ?? rule.escalationAfterMinutes,
    });
    const updated = await this.prisma.aMCSLARule.update({
      where: { id },
      data: {
        priority: dto.priority,
        responseTimeMinutes: dto.responseTimeMinutes,
        resolutionTimeMinutes: dto.resolutionTimeMinutes,
        escalationAfterMinutes: dto.escalationAfterMinutes,
      },
    });
    await this.slaChanged(contract, actor, updated.priority);
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const { rule, contract } = await this.loadRuleOrThrow(id);
    await this.prisma.aMCSLARule.delete({ where: { id } });
    await this.slaChanged(contract, actor, rule.priority);
    return { id, deleted: true };
  }

  private async loadRuleOrThrow(id: string) {
    const rule = await this.prisma.aMCSLARule.findUnique({ where: { id }, include: { contract: true } });
    if (!rule || rule.contract.deletedAt) throw new NotFoundException('SLA rule not found');
    const contract = await this.contracts.loadOrThrow(rule.contractId); // tenant-verify
    return { rule, contract };
  }

  private async slaChanged(contract: AMCContract, actor: AuthenticatedUser, priority: string) {
    await this.history.record({
      contractId: contract.id, eventType: AMCEventType.UPDATED, performedById: actor.id,
      metadata: { sla: true, priority },
    });
    const event = {
      name: DomainEventName.AMCSLAChanged,
      tenantId: contract.tenantId,
      communityId: contract.communityId,
      actorId: actor.id,
      entityId: contract.id,
      data: { contractNumber: contract.contractNumber, vendorId: contract.vendorId, priority },
    } satisfies Omit<AMCEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
