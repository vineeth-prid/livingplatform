import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SettingsService } from '../../modules/settings/settings.service';

export const REQUIRE_MODULE_KEY = 'requireCommunityModule';

/** Optional community modules a route can be gated on. */
export type CommunityModule = 'maintenanceBilling' | 'servicePackages';

/**
 * Gate a controller (or one route) on a community module toggle.
 *
 *   @RequireCommunityModule('maintenanceBilling')
 *   @Controller('communities/:communityId/maintenance-invoices')
 *
 * Applied at the CLASS level this covers every route on that controller —
 * including ones added later, which is the point: a per-method check is one
 * `git push` away from being forgotten on a new endpoint.
 */
export const RequireCommunityModule = (module: CommunityModule) =>
  SetMetadata(REQUIRE_MODULE_KEY, module);

/**
 * Resolves `:communityId` from the route and refuses when the module is off.
 *
 * **404, not 403.** For a community that has not enabled maintenance billing
 * these endpoints genuinely do not exist; a 403 would confirm the feature is
 * merely switched off and invite probing. This mirrors how cross-tenant ids
 * already return 404 rather than leaking existence.
 */
@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settings: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<CommunityModule>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ params?: Record<string, string> }>();
    const communityId = request.params?.communityId;
    // No community in the route → nothing community-scoped to gate.
    if (!communityId) return true;

    const features = await this.settings.features(communityId);
    if (!features[required]) {
      throw new NotFoundException(
        required === 'maintenanceBilling'
          ? 'Maintenance billing is not enabled for this community'
          : 'Service packages are not enabled for this community',
      );
    }
    return true;
  }
}
