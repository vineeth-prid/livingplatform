import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Request-scoped access to the current tenant/community context, derived from
 * the authenticated principal. Services that must scope queries to a tenant
 * inject this instead of reaching into the raw request.
 *
 * This is the single source of "who is asking and in which tenant" — the
 * groundwork for every future module's row-level scoping. A Platform Admin has
 * a null tenantId and is allowed to operate cross-tenant.
 *
 * ponytail: derived from the JWT principal (no per-request DB hit). Postgres
 * row-level security is the future hardening if defense-in-depth is required.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(
    @Inject(REQUEST) private readonly request: { user?: AuthenticatedUser },
  ) {}

  get user(): AuthenticatedUser | undefined {
    return this.request.user;
  }

  get tenantId(): string | null {
    return this.request.user?.tenantId ?? null;
  }

  /** True for platform-level principals that may cross tenant boundaries. */
  get isPlatform(): boolean {
    return (this.request.user?.roles ?? []).some((r) => r.scope === 'PLATFORM');
  }
}
