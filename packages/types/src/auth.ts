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
  mustChangePassword?: boolean;
  /** Two-factor sign-in (authenticator app) is on for this account. */
  mfaEnabled?: boolean;
  /** Two-factor is required for this account's role and not set up yet. */
  mfaSetupRequired?: boolean;
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
  /** Six-digit authenticator code — sent on the second step when two-factor is on. */
  mfaCode?: string;
}

/** Returned when two-factor enrolment starts. */
export interface MfaSetup {
  /** Base32 key for manual entry in an authenticator app. */
  secret: string;
  /** otpauth:// URI (what a QR code would encode). */
  otpauthUrl: string;
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
