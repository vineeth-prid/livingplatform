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

  /**
   * The caller's HOME tenant — where their account lives, and the default for
   * anything created without a community context. NOT the limit of what they
   * can reach: use `canAccessTenant` for that.
   */
  get tenantId(): string | null {
    return this.request.user?.tenantId ?? null;
  }

  /**
   * Every tenant the caller can operate in.
   *
   * One person may hold communities across several tenants — an owner with
   * flats in two, staff working across three, a resident who moved. Falls back
   * to the home tenant for tokens minted before this existed, so a session
   * issued by the previous build keeps working until it refreshes.
   */
  get tenantIds(): string[] {
    const user = this.request.user;
    if (!user) return [];
    if (user.tenantIds?.length) return user.tenantIds;
    return user.tenantId ? [user.tenantId] : [];
  }

  /** May the caller operate inside this tenant? Platform admins always may. */
  canAccessTenant(tenantId: string | null | undefined): boolean {
    if (this.isPlatform) return true;
    if (!tenantId) return false;
    return this.tenantIds.includes(tenantId);
  }

  /** True for platform-level principals that may cross tenant boundaries. */
  get isPlatform(): boolean {
    return (this.request.user?.roles ?? []).some((r) => r.scope === 'PLATFORM');
  }
}
