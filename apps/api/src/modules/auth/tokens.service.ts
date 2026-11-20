import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import type { AppConfig } from '../../config/configuration';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  Impersonator,
} from '../../common/types/authenticated-user';
import { expiryFrom } from '../../common/utils/duration';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { SessionSecurityService } from './session-security.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // access token lifetime, seconds
}

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Issues and rotates auth tokens.
 *
 *  - Access token: short-lived JWT carrying the flattened roles/permissions so
 *    guards authorize with no DB hit.
 *  - Refresh token: opaque `"<rowId>.<secret>"`. Only the argon2 hash of the
 *    secret is stored; the row id is the selector for O(1) lookup. Rotation
 *    revokes the old row and mints a new one in the same family. Re-use of an
 *    already-rotated/revoked token revokes the ENTIRE family (theft detection).
 */
/**
 * Refresh secrets are 256 random bits, so a fast hash protects them exactly as
 * well as a slow one — argon2's cost only helps for guessable inputs such as
 * passwords. It was adding ~100 ms to every sign-in and every token refresh.
 * Rows hashed with argon2 before this change still verify.
 */
const SHA256_PREFIX = 'sha256:';
export function hashRefreshSecret(secret: string): string {
  return SHA256_PREFIX + createHash('sha256').update(secret).digest('hex');
}
export async function verifyRefreshSecret(stored: string, secret: string): Promise<boolean> {
  if (stored.startsWith(SHA256_PREFIX)) {
    const a = Buffer.from(stored);
    const b = Buffer.from(hashRefreshSecret(secret));
    return a.length === b.length && timingSafeEqual(a, b);
  }
  return argon2.verify(stored, secret).catch(() => false);
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly authCfg: AppConfig['auth'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rbac: RbacService,
    private readonly sessions: SessionSecurityService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.authCfg = config.get('auth', { infer: true });
  }

  /** Issue a fresh access + refresh pair, starting a new refresh family. Pass
   *  `impersonatedBy` for a Platform-Admin "log in as" session so the marker is
   *  carried in the token and persisted for rotation. */
  async issuePair(
    principal: AuthenticatedUser,
    rememberMe: boolean,
    meta: RequestMeta,
    impersonatedBy?: Impersonator | null,
  ): Promise<TokenPair> {
    const familyId = randomUUID();
    return this.mint(principal, familyId, rememberMe, meta, undefined, impersonatedBy);
  }

  /**
   * Validate a presented refresh token and rotate it. Returns a new pair plus
   * the freshly-resolved principal (so permission changes take effect on
   * refresh). Throws Unauthorized on any invalid/reused token.
   */
  async rotate(
    presented: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<{ pair: TokenPair; principal: AuthenticatedUser }> {
    const { id, secret } = this.split(presented);

    const row = await this.prisma.refreshToken.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true, email: true, tenantId: true, status: true, deletedAt: true,
            mustChangePassword: true, mfaEnabledAt: true,
          },
        },
      },
    });
    // (impersonatorId/Email selected implicitly by findUnique — used below.)

    if (!row) throw new UnauthorizedException('Invalid refresh token');

    // Re-use detection: a revoked token being presented means it was already
    // rotated (or the family was compromised). Nuke the whole family.
    if (row.revokedAt) {
      await this.revokeFamily(row.familyId);
      this.logger.warn(
        `Refresh token re-use detected for user ${row.userId}; family ${row.familyId} revoked`,
      );
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const valid = await verifyRefreshSecret(row.tokenHash, secret);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    if (!row.user || row.user.deletedAt || row.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const principal = this.withRestrictions(
      await this.rbac.buildPrincipal({
        id: row.user.id,
        email: row.user.email,
        tenantId: row.user.tenantId,
      }),
      row.user,
    );

    // Preserve the impersonation marker across rotation so a refreshed session
    // never sheds its attribution to the real operator.
    const impersonatedBy: Impersonator | null =
      row.impersonatorId && row.impersonatorEmail
        ? { id: row.impersonatorId, email: row.impersonatorEmail }
        : null;

    // Mint the replacement in the same family, then mark this row rotated.
    const pair = await this.mint(principal, row.familyId, rememberMe, meta, row.id, impersonatedBy);
    return { pair, principal };
  }

  /**
   * Revoke a single refresh token (logout on this device). The secret half is
   * verified first: knowing a row id alone must not let anyone sign a user out.
   */
  async revoke(presented: string): Promise<void> {
    const { id, secret } = this.split(presented);
    const row = await this.prisma.refreshToken.findUnique({ where: { id }, select: { tokenHash: true } });
    if (!row || !(await verifyRefreshSecret(row.tokenHash, secret))) return;
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke every session for a user (logout everywhere): their refresh tokens,
   * AND — via the Redis marker JwtStrategy checks — every live access token,
   * so a suspension or password change bites immediately, not 15 minutes later.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.sessions.revokeSessions(userId);
  }

  /**
   * Stamp the restricted-session flags onto a principal: a one-time password
   * still in use, or two-factor enrolment required by AUTH_MFA_REQUIRED_ROLES
   * but not done. RestrictedSessionGuard enforces both server-side.
   */
  withRestrictions(
    principal: AuthenticatedUser,
    user: { mustChangePassword: boolean; mfaEnabledAt: Date | null },
  ): AuthenticatedUser {
    const required = this.authCfg.mfaRequiredRoles;
    const mfaSetupRequired =
      !user.mfaEnabledAt && principal.roles.some((r) => required.includes(r.key));
    return { ...principal, mustChangePassword: user.mustChangePassword, mfaSetupRequired };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async mint(
    principal: AuthenticatedUser,
    familyId: string,
    rememberMe: boolean,
    meta: RequestMeta,
    replacesId?: string,
    impersonatedBy?: Impersonator | null,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = {
      sub: principal.id,
      email: principal.email,
      tenantId: principal.tenantId,
      tenantIds: principal.tenantIds,
      roles: principal.roles,
      permissions: principal.permissions,
      type: 'access',
      ...(impersonatedBy ? { impersonatedBy } : {}),
      ...(principal.mustChangePassword ? { mcp: true as const } : {}),
      ...(principal.mfaSetupRequired ? { mfaSetup: true as const } : {}),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.authCfg.accessSecret,
      expiresIn: this.authCfg.accessTtl,
    });

    const secret = randomBytes(32).toString('base64url');
    const tokenHash = hashRefreshSecret(secret);
    const ttl = rememberMe
      ? this.authCfg.refreshTtlRemember
      : this.authCfg.refreshTtl;

    const created = await this.prisma.refreshToken.create({
      data: {
        userId: principal.id,
        tokenHash,
        familyId,
        expiresAt: expiryFrom(ttl),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        impersonatorId: impersonatedBy?.id ?? null,
        impersonatorEmail: impersonatedBy?.email ?? null,
      },
      select: { id: true },
    });

    if (replacesId) {
      await this.prisma.refreshToken.update({
        where: { id: replacesId },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    }

    return {
      accessToken,
      refreshToken: `${created.id}.${secret}`,
      tokenType: 'Bearer',
      expiresIn: Math.floor(
        expiryFrom(this.authCfg.accessTtl).getTime() / 1000 -
          Date.now() / 1000,
      ),
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private split(token: string): { id: string; secret: string } {
    const idx = token.indexOf('.');
    if (idx <= 0) throw new UnauthorizedException('Malformed refresh token');
    return { id: token.slice(0, idx), secret: token.slice(idx + 1) };
  }
}
