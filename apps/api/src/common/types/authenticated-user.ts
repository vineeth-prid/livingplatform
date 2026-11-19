import { RoleScope } from '@prisma/client';

/** One role a user holds, with the scope it applies at. */
export interface AssignedRole {
  key: string;
  scope: RoleScope;
  communityId: string | null;
}

/**
 * The authenticated principal attached to `request.user` by JwtStrategy.
 * Carries the flattened permission set so guards can authorize without a DB
 * round-trip on every request.
 *
 * Permissions are embedded from the access token (minted at login/refresh). A
 * permission change takes effect on the user's next token refresh (≤ access
 * TTL); suspension, password changes and sign-out-everywhere revoke live access
 * tokens immediately via SessionSecurityService.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  /**
   * The user's HOME tenant — where their account was created, and the default
   * for anything created without a community context. It is no longer the limit
   * of what they can reach: see `tenantIds`.
   */
  tenantId: string | null;
  /**
   * EVERY tenant this person can operate in — their home tenant plus the tenant
   * of every community they hold a role grant in.
   *
   * One human, one login. An owner with flats in two communities, a supervisor
   * working across three, a resident who moved: each is one account with access
   * to several places, rather than duplicate people who must remember which
   * password belongs to which gate. Authorization is still per community; this
   * is only the set of tenants those communities live in.
   *
   * Empty for a Platform Admin, who is not tenant-bound at all.
   */
  tenantIds: string[];
  roles: AssignedRole[];
  permissions: string[];
  /** Set when this is a Platform-Admin impersonation session; identifies the
   *  real operator so their actions stay attributable in the audit trail. */
  impersonatedBy?: Impersonator | null;
  /**
   * Restricted session: the account still holds a one-time password, or must
   * enrol in two-factor sign-in. Only the routes that resolve that are allowed
   * (RestrictedSessionGuard) — the app gate alone could be skipped by calling
   * the API directly.
   */
  mustChangePassword?: boolean;
  mfaSetupRequired?: boolean;
}

/** The real operator behind an impersonation ("log in as") session. */
export interface Impersonator {
  id: string;
  email: string;
}

/** JWT access-token payload shape. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  tenantId: string | null;
  /** See AuthenticatedUser.tenantIds. Absent on tokens minted before multi-
   *  community access existed — treated as `[tenantId]`. */
  tenantIds?: string[];
  roles: AssignedRole[];
  permissions: string[];
  type: 'access';
  /** Present only on impersonation sessions (see AuthenticatedUser). */
  impersonatedBy?: Impersonator | null;
  /** Restricted-session claims (see AuthenticatedUser). */
  mcp?: true;
  mfaSetup?: true;
  /** Issued-at (seconds), set by jsonwebtoken — compared with session revocation. */
  iat?: number;
}

/** JWT refresh-token payload shape (kept minimal — authority is the DB row). */
export interface RefreshTokenPayload {
  sub: string;
  jti: string; // matches the RefreshToken row this token was minted for
  family: string;
  type: 'refresh';
}
