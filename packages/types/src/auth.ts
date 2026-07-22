import type { ID, ISODate } from './common';
import type { UserStatus } from './enums';

export type Permission = string;
export type RoleScope = 'PLATFORM' | 'TENANT' | 'COMMUNITY';

export interface AssignedRole {
  key: string;
  scope: RoleScope;
  communityId: ID | null;
}

/** JWT access-token payload (decoded client-side for roles/permissions). */
export interface AccessTokenPayload {
  sub: ID;
  email: string;
  tenantId: ID | null;
  roles: AssignedRole[];
  permissions: Permission[];
  type: 'access';
  exp: number;
  iat: number;
}

export interface PublicUser {
  id: ID;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: ID | null;
  status: UserStatus;
  emailVerified: boolean;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** The resolved session the app holds: identity + effective authorization. */
export interface Session {
  user: PublicUser;
  tenantId: ID | null;
  roles: AssignedRole[];
  permissions: Permission[];
  accessTokenExpiresAt: ISODate;
}
