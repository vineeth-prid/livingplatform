import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfig } from '../../../config/configuration';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../../common/types/authenticated-user';
import { SessionSecurityService } from '../session-security.service';

/**
 * Validates the access token signature/expiry and returns the principal that
 * gets attached to `request.user`. Roles/permissions ride inside the token, so
 * authorization stays DB-free; the one extra hop is a Redis GET that rejects
 * tokens issued before a session revocation (suspension, password change,
 * sign-out-everywhere).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly sessions: SessionSecurityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('auth', { infer: true }).accessSecret,
      // Pin the algorithm we sign with; never let the token header choose.
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (await this.sessions.isRevoked(payload.sub, payload.iat)) {
      throw new UnauthorizedException('Session has been revoked — please sign in again');
    }
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      tenantIds: payload.tenantIds ?? (payload.tenantId ? [payload.tenantId] : []),
      roles: payload.roles,
      permissions: payload.permissions,
      impersonatedBy: payload.impersonatedBy ?? null,
      mustChangePassword: payload.mcp === true,
      mfaSetupRequired: payload.mfaSetup === true,
    };
  }
}
