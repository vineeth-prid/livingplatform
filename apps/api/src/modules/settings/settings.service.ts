import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CommunityModulesService,
  type CommunityFeatures,
} from './community-modules.service';
import { UpdateCommunitySettingsDto } from './dto/update-settings.dto';

export type { CommunityFeatures };

const json = (v: unknown) => v as Prisma.InputJsonValue | undefined;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
    private readonly modules: CommunityModulesService,
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
      maintenanceBillingEnabled: dto.maintenanceBillingEnabled,
      servicePackagesEnabled: dto.servicePackagesEnabled,
      gateManagementEnabled: dto.gateManagementEnabled,
      gateApprovalEnabled: dto.gateApprovalEnabled,
      gatePushEnabled: dto.gatePushEnabled,
      gateWhatsappEnabled: dto.gateWhatsappEnabled,
      gateEmailEnabled: dto.gateEmailEnabled,
      gateSoundEnabled: dto.gateSoundEnabled,
      homeBanners: json(dto.homeBanners),
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

  // ── Module toggles ─────────────────────────────────────────────────────────
  //
  // Delegated to CommunityModulesService, which is a SINGLETON. This service is
  // request-scoped (it injects CommunityAccessService → TenantContextService),
  // and toggles must be readable from a global guard and from cron — neither of
  // which may be request-scoped. These pass-throughs exist so callers that
  // already hold SettingsService need not know that; there is still exactly one
  // implementation of "is this module on?".

  /** Every module toggle in one read — what the frontends gate their UI on. */
  features(communityId: string): Promise<CommunityFeatures> {
    return this.modules.features(communityId);
  }

  isMaintenanceBillingEnabled(communityId: string): Promise<boolean> {
    return this.modules.isEnabled(communityId, 'maintenanceBilling');
  }

  assertMaintenanceBillingEnabled(communityId: string): Promise<void> {
    return this.modules.assertEnabled(communityId, 'maintenanceBilling');
  }

  assertServicePackagesEnabled(communityId: string): Promise<void> {
    return this.modules.assertEnabled(communityId, 'servicePackages');
  }

  maintenanceEnabledByCommunity(communityIds: string[]): Promise<Map<string, boolean>> {
    return this.modules.maintenanceEnabledByCommunity(communityIds);
  }
}
