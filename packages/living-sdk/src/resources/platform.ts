import type { AuthResult, ListParams, Paginated } from '@living/types';

import type { HttpClient } from '../http';

export interface ProvisionCommunityInput {
  name: string;
  code: string;
  type: string;
  city?: string;
  state?: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface ProvisionCommunityResult<C = unknown> {
  community: C;
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword: string;
  };
}

export interface CommunityAdminAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface CommunityRevenueRow {
  communityId: string;
  communityName: string;
  communityCode: string;
  status: string;
  maintenanceEnabled: boolean;
  totalCollected: number;
  maintenanceCollected: number;
  serviceCollected: number;
  last30Days: number;
  paymentCount: number;
  lastPaymentAt: string | null;
}

/** Platform-level reads: RBAC catalog, users, profile, health — and provisioning. */
export class PlatformResource {
  constructor(private readonly http: HttpClient) {}

  /** Provision a community + its Association Admin in one call (Platform Admin only). */
  provisionCommunity<C = unknown>(input: ProvisionCommunityInput): Promise<ProvisionCommunityResult<C>> {
    return this.http.post('/admin/communities', input);
  }

  /**
   * A community's Association Admin login. The password is never returned —
   * it is an argon2 hash and cannot be reversed. Use
   * `auth.adminResetPassword(account.id)` to issue a new one.
   */
  communityAdmin(communityId: string): Promise<CommunityAdminAccount> {
    return this.http.get(`/admin/communities/${communityId}/admin`);
  }

  /**
   * "Log in as" a community's Association Admin (Platform Admin only). Swaps the
   * client's tokens to the community admin's session — the caller is responsible
   * for stashing the platform tokens first if it wants to return.
   */
  async loginAsCommunity(communityId: string): Promise<AuthResult> {
    const result = await this.http.post<AuthResult>(`/admin/communities/${communityId}/login-as`);
    this.http.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  }

  // RBAC
  listRoles<T = unknown>(): Promise<T[]> {
    return this.http.get('/rbac/roles');
  }
  listPermissions<T = unknown>(): Promise<T[]> {
    return this.http.get('/rbac/permissions');
  }

  // Users (admin)
  listUsers<T = unknown>(params?: ListParams): Promise<Paginated<T>> {
    return this.http.get('/users', { ...params });
  }
  getUser<T = unknown>(id: string): Promise<T> {
    return this.http.get(`/users/${id}`);
  }
  updateUserStatus<T = unknown>(id: string, status: string): Promise<T> {
    return this.http.patch(`/users/${id}/status`, { status });
  }

  // Self-service profile
  getProfile<T = unknown>(): Promise<T> {
    return this.http.get('/profile/me');
  }
  updateProfile<T = unknown>(input: Record<string, unknown>): Promise<T> {
    return this.http.put('/profile/me', input);
  }

  // Health
  liveness(): Promise<{ status: string; timestamp: string }> {
    return this.http.get('/health');
  }
  readiness<T = unknown>(): Promise<T> {
    return this.http.get('/health/ready');
  }

  // Platform Admin analytics (real DB aggregates)
  statsOverview<T = unknown>(): Promise<T> {
    return this.http.get('/admin/stats/overview');
  }
  auditLog<T = unknown>(params?: ListParams & Record<string, unknown>): Promise<Paginated<T>> {
    return this.http.get('/admin/stats/audit', params);
  }
  auditSummary<T = unknown>(): Promise<T> {
    return this.http.get('/admin/stats/audit/summary');
  }
  auditModules(): Promise<string[]> {
    return this.http.get('/admin/stats/audit/modules');
  }
  /** Collection totals per community, split maintenance / service. Totals only. */
  revenueByCommunity(): Promise<CommunityRevenueRow[]> {
    return this.http.get('/admin/stats/revenue-by-community');
  }
  systemInfo<T = unknown>(): Promise<T> {
    return this.http.get('/admin/stats/system');
  }
}
