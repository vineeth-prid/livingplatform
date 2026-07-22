import type { ListParams, Paginated } from '@living/types';

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

/** Platform-level reads: RBAC catalog, users, profile, health — and provisioning. */
export class PlatformResource {
  constructor(private readonly http: HttpClient) {}

  /** Provision a community + its Association Admin in one call (Platform Admin only). */
  provisionCommunity<C = unknown>(input: ProvisionCommunityInput): Promise<ProvisionCommunityResult<C>> {
    return this.http.post('/admin/communities', input);
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
}
