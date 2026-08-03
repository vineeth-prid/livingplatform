import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/** The optional modules a community can switch on or off. */
export interface CommunityFeatures {
  maintenanceBilling: boolean;
  servicePackages: boolean;
}

/** Every optional module is ON until a community says otherwise. */
const DEFAULTS: CommunityFeatures = {
  maintenanceBilling: true,
  servicePackages: true,
};

/**
 * Reads community module toggles. **Deliberately a singleton.**
 *
 * This exists as its own service, rather than as methods on SettingsService,
 * because of who needs to ask the question:
 *
 *   • `ModuleEnabledGuard` is a global APP_GUARD
 *   • `BillingSchedulerService` owns `@Cron` handlers
 *
 * Neither may be request-scoped. `SettingsService` is — it injects
 * `CommunityAccessService`, which injects the REQUEST-scoped
 * `TenantContextService` — and Nest bubbles that scope to every consumer. A
 * request-scoped global guard resolves `@Inject(REQUEST)` on every single
 * request, and `ScheduleModule` only discovers cron handlers on singletons, so
 * a request-scoped scheduler silently never runs.
 *
 * So this class depends on PrismaService and nothing else. Adding any
 * request-scoped dependency here would break both of those consumers again —
 * community-modules.spec.ts asserts it stays resolvable as a singleton.
 *
 * Tenant scoping is not lost: the guard only gates routes whose service layer
 * already calls `CommunityAccessService.assert(communityId)`, and reading two
 * booleans for an id the caller cannot reach leaks nothing.
 */
@Injectable()
export class CommunityModulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Which modules a community runs. A community with no settings row yet gets
   * the defaults — that is what keeps the toggles non-breaking for every
   * community that predates them.
   */
  async features(communityId: string): Promise<CommunityFeatures> {
    const row = await this.prisma.communitySettings.findUnique({
      where: { communityId },
      select: { maintenanceBillingEnabled: true, servicePackagesEnabled: true },
    });
    if (!row) return { ...DEFAULTS };
    return {
      maintenanceBilling: row.maintenanceBillingEnabled,
      servicePackages: row.servicePackagesEnabled,
    };
  }

  async isEnabled(communityId: string, feature: keyof CommunityFeatures): Promise<boolean> {
    return (await this.features(communityId))[feature];
  }

  /**
   * Guard for maintenance-billing reads and writes. 404 rather than 403: for a
   * community that has not enabled the module these endpoints genuinely do not
   * exist, and a 403 would confirm the feature is merely switched off.
   */
  async assertEnabled(communityId: string, feature: keyof CommunityFeatures): Promise<void> {
    if (await this.isEnabled(communityId, feature)) return;
    throw new NotFoundException(
      feature === 'maintenanceBilling'
        ? 'Maintenance billing is not enabled for this community'
        : 'Service packages are not enabled for this community',
    );
  }

  /** Bulk lookup for dashboards and the nightly sweep — one query instead of N. */
  async maintenanceEnabledByCommunity(communityIds: string[]): Promise<Map<string, boolean>> {
    if (communityIds.length === 0) return new Map();
    const rows = await this.prisma.communitySettings.findMany({
      where: { communityId: { in: communityIds } },
      select: { communityId: true, maintenanceBillingEnabled: true },
    });
    const byId = new Map(rows.map((r) => [r.communityId, r.maintenanceBillingEnabled]));
    return new Map(
      communityIds.map((id) => [id, byId.get(id) ?? DEFAULTS.maintenanceBilling]),
    );
  }
}
