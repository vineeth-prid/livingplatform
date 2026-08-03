import { Injectable, NotFoundException } from '@nestjs/common';
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
      maintenanceBillingEnabled: dto.maintenanceBillingEnabled,
      servicePackagesEnabled: dto.servicePackagesEnabled,
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
  // ONE place answers "is this module on for this community?". Every guard —
  // billing, payments, packages, the resident app's feature list — reads from
  // here, so a toggle can never be honoured in one code path and ignored in
  // another. A community with no settings row yet gets the defaults (on), which
  // is what keeps this change non-breaking.

  /** Every module toggle in one read — what the frontends gate their UI on. */
  async features(communityId: string): Promise<CommunityFeatures> {
    const row = await this.prisma.communitySettings.findUnique({
      where: { communityId },
      select: { maintenanceBillingEnabled: true, servicePackagesEnabled: true },
    });
    return {
      maintenanceBilling: row?.maintenanceBillingEnabled ?? true,
      servicePackages: row?.servicePackagesEnabled ?? true,
    };
  }

  async isMaintenanceBillingEnabled(communityId: string): Promise<boolean> {
    return (await this.features(communityId)).maintenanceBilling;
  }

  /**
   * Guard for every maintenance-billing write and read. 404 rather than 403:
   * when a community has not enabled the module, the endpoints genuinely do not
   * exist for it, and a 403 would confirm the feature is merely switched off.
   */
  async assertMaintenanceBillingEnabled(communityId: string): Promise<void> {
    if (!(await this.isMaintenanceBillingEnabled(communityId))) {
      throw new NotFoundException('Maintenance billing is not enabled for this community');
    }
  }

  async assertServicePackagesEnabled(communityId: string): Promise<void> {
    const { servicePackages } = await this.features(communityId);
    if (!servicePackages) {
      throw new NotFoundException('Service packages are not enabled for this community');
    }
  }

  /** Bulk lookup for dashboards — one query instead of N. */
  async maintenanceEnabledByCommunity(
    communityIds: string[],
  ): Promise<Map<string, boolean>> {
    const rows = await this.prisma.communitySettings.findMany({
      where: { communityId: { in: communityIds } },
      select: { communityId: true, maintenanceBillingEnabled: true },
    });
    const byId = new Map(rows.map((r) => [r.communityId, r.maintenanceBillingEnabled]));
    // Communities without a settings row run on the defaults.
    return new Map(communityIds.map((id) => [id, byId.get(id) ?? true]));
  }
}

/** The module toggles a client needs to decide what to render. */
export interface CommunityFeatures {
  maintenanceBilling: boolean;
  servicePackages: boolean;
}
