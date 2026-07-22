import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfig } from '../../../config/configuration';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../../common/types/authenticated-user';

/**
 * Validates the access token signature/expiry and returns the principal that
 * gets attached to `request.user`. Roles/permissions ride inside the token, so
 * this is a pure, DB-free verification on the request hot path.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('auth', { infer: true }).accessSecret,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
