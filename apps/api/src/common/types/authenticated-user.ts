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
 * ponytail: permissions are embedded from the access token (minted at
 * login/refresh). A permission change takes effect on the user's next token
 * refresh (≤ access TTL). Move to a Redis-backed live lookup if you need
 * instant revocation.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string | null;
  roles: AssignedRole[];
  permissions: string[];
}

/** JWT access-token payload shape. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  tenantId: string | null;
  roles: AssignedRole[];
  permissions: string[];
  type: 'access';
}

/** JWT refresh-token payload shape (kept minimal — authority is the DB row). */
export interface RefreshTokenPayload {
  sub: string;
  jti: string; // matches the RefreshToken row this token was minted for
  family: string;
  type: 'refresh';
}
