import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CommunityModulesService } from '../../modules/settings/community-modules.service';

export const REQUIRE_MODULE_KEY = 'requireCommunityModule';

/** Optional community modules a route can be gated on. */
export type CommunityModule = 'maintenanceBilling' | 'servicePackages' | 'services';

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
/**
 * Every module named must be on. A handler-level decorator replaces the class
 * one (as before), so a handler that needs an extra module names all of them.
 */
export const RequireCommunityModule = (...modules: CommunityModule[]) =>
  SetMetadata(REQUIRE_MODULE_KEY, modules.length === 1 ? modules[0] : modules);

/**
 * Resolves `:communityId` from the route and refuses when the module is off.
 *
 * **404, not 403.** For a community that has not enabled maintenance billing
 * these endpoints genuinely do not exist; a 403 would confirm the feature is
 * merely switched off and invite probing. This mirrors how cross-tenant ids
 * already return 404 rather than leaking existence.
 *
 * **This guard MUST stay a singleton.** It is registered as a global APP_GUARD,
 * so it is constructed for every request in the application. Injecting anything
 * request-scoped here — `SettingsService`, `CommunityAccessService`,
 * `TenantContextService` — makes the guard request-scoped and forces Nest to
 * resolve an `@Inject(REQUEST)` chain on every request, including the ones this
 * guard exits immediately. `CommunityModulesService` exists precisely so this
 * dependency stays singleton-safe; module-enabled.guard.spec.ts fails if that
 * ever regresses.
 */
@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: CommunityModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<CommunityModule | CommunityModule[] | undefined>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    // The overwhelming majority of routes are not gated — leave before any I/O.
    if (!metadata) return true;
    const required = Array.isArray(metadata) ? metadata : [metadata];

    // Non-HTTP execution contexts (cron, events) carry no route to gate.
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ params?: Record<string, string> }>();
    const communityId = request.params?.communityId;
    // No community in the route → nothing community-scoped to gate.
    if (!communityId) return true;

    for (const module of required) await this.modules.assertEnabled(communityId, module);
    return true;
  }
}
