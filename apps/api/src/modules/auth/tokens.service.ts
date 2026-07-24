import { randomBytes, randomUUID } from 'node:crypto';

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
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly authCfg: AppConfig['auth'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rbac: RbacService,
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
      include: { user: { select: { id: true, email: true, tenantId: true, status: true, deletedAt: true } } },
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

    const valid = await argon2.verify(row.tokenHash, secret);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    if (!row.user || row.user.deletedAt || row.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const principal = await this.rbac.buildPrincipal({
      id: row.user.id,
      email: row.user.email,
      tenantId: row.user.tenantId,
    });

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

  /** Revoke a single refresh token (logout on this device). */
  async revoke(presented: string): Promise<void> {
    const { id } = this.split(presented);
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every active refresh token for a user (logout everywhere). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
      roles: principal.roles,
      permissions: principal.permissions,
      type: 'access',
      ...(impersonatedBy ? { impersonatedBy } : {}),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.authCfg.accessSecret,
      expiresIn: this.authCfg.accessTtl,
    });

    const secret = randomBytes(32).toString('base64url');
    const tokenHash = await argon2.hash(secret, { type: argon2.argon2id });
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
