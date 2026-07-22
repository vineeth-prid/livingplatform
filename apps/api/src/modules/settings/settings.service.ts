import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { UpdateCommunitySettingsDto } from './dto/update-settings.dto';

const json = (v: unknown) => v as Prisma.InputJsonValue | undefined;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async get(communityId: string) {
    await this.access.assert(communityId);
    // Communities created this sprint always have a settings row; older ones
    // (or edge cases) get one lazily so the UI always has a target.
    return this.prisma.communitySettings.upsert({
      where: { communityId },
      create: { communityId },
      update: {},
    });
  }

  async update(
    communityId: string,
    dto: UpdateCommunitySettingsDto,
    actor: AuthenticatedUser,
  ) {
    await this.access.assert(communityId);
    const data = {
      workingHours: json(dto.workingHours),
      maintenanceWindows: json(dto.maintenanceWindows),
      supportContacts: json(dto.supportContacts),
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      emailEnabled: dto.emailEnabled,
      smsEnabled: dto.smsEnabled,
      whatsappEnabled: dto.whatsappEnabled,
      pushEnabled: dto.pushEnabled,
      petPolicy: json(dto.petPolicy),
      parkingPolicy: json(dto.parkingPolicy),
      customSettings: json(dto.customSettings),
      updatedById: actor.id,
    };
    const settings = await this.prisma.communitySettings.upsert({
      where: { communityId },
      create: { communityId, ...data },
      update: data,
    });
    this.events.publish({
      name: DomainEventName.SettingsUpdated,
      ...this.events.from(actor, communityId),
      entityId: settings.id,
      data: {},
    });
    return settings;
  }
}
