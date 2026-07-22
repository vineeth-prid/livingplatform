import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AMCContract, AMCEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AMCEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { AmcContractService } from './amc-contract.service';
import { AmcHistoryService } from './amc-history.service';
import { AddCoverageDto } from './dto/coverage.dto';

/** Which assets a contract covers. Assets remain independent — FK only. */
@Injectable()
export class AmcCoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: AmcContractService,
    private readonly events: DomainEventsService,
    private readonly history: AmcHistoryService,
  ) {}

  async add(contractId: string, dto: AddCoverageDto, actor: AuthenticatedUser) {
    const contract = await this.contracts.loadOrThrow(contractId);
    await this.assertAssetInCommunity(dto.assetId, contract.communityId);

    const existing = await this.prisma.aMCCoverage.findUnique({
      where: { contractId_assetId: { contractId, assetId: dto.assetId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('This asset is already covered by the contract');

    const coverage = await this.prisma.aMCCoverage.create({
      data: {
        contractId,
        assetId: dto.assetId,
        coverageType: dto.coverageType ?? 'FULL',
        responseTimeHours: dto.responseTimeHours,
        resolutionTimeHours: dto.resolutionTimeHours,
        visitFrequency: dto.visitFrequency,
        priority: dto.priority ?? 'MEDIUM',
        remarks: dto.remarks,
      },
    });
    await this.history.record({
      contractId, eventType: AMCEventType.ASSET_ADDED, performedById: actor.id,
      metadata: { assetId: dto.assetId, coverageType: coverage.coverageType },
    });
    this.publish(DomainEventName.AMCAssetCovered, contract, actor, dto.assetId);
    return coverage;
  }

  async remove(contractId: string, assetId: string, actor: AuthenticatedUser) {
    const contract = await this.contracts.loadOrThrow(contractId);
    const coverage = await this.prisma.aMCCoverage.findUnique({
      where: { contractId_assetId: { contractId, assetId } },
      select: { id: true },
    });
    if (!coverage) throw new NotFoundException('Coverage not found');

    await this.prisma.aMCCoverage.delete({ where: { id: coverage.id } });
    await this.history.record({
      contractId, eventType: AMCEventType.ASSET_REMOVED, performedById: actor.id, metadata: { assetId },
    });
    this.publish(DomainEventName.AMCAssetRemoved, contract, actor, assetId);
    return { contractId, assetId, removed: true };
  }

  async list(contractId: string) {
    await this.contracts.loadOrThrow(contractId);
    return this.prisma.aMCCoverage.findMany({
      where: { contractId },
      orderBy: { createdAt: 'asc' },
      include: { asset: { select: { id: true, assetCode: true, name: true, status: true, criticality: true } } },
    });
  }

  private async assertAssetInCommunity(assetId: string, communityId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new BadRequestException('Asset does not belong to this community');
  }

  private publish(
    name: typeof DomainEventName.AMCAssetCovered | typeof DomainEventName.AMCAssetRemoved,
    contract: AMCContract,
    actor: AuthenticatedUser,
    assetId: string,
  ): void {
    const event = {
      name,
      tenantId: contract.tenantId,
      communityId: contract.communityId,
      actorId: actor.id,
      entityId: contract.id,
      data: { contractNumber: contract.contractNumber, vendorId: contract.vendorId, assetId },
    } satisfies Omit<AMCEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
