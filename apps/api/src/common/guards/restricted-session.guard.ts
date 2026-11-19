import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '../types/authenticated-user';

const ALLOW_RESTRICTED_KEY = 'allowRestrictedSession';

/** Marks a route usable while the session is restricted (see the guard below). */
export const AllowRestrictedSession = () => SetMetadata(ALLOW_RESTRICTED_KEY, true);

/** 403 the apps recognise (by `error`) to show their set-password / 2FA screen. */
export class PasswordChangeRequiredException extends ForbiddenException {
  constructor() {
    super('Set a new password before continuing');
  }
}

export class MfaSetupRequiredException extends ForbiddenException {
  constructor() {
    super('Set up two-factor sign-in before continuing');
  }
}

/**
 * Server-side enforcement of the first-login password change (and of required
 * two-factor enrolment).
 *
 * `mustChangePassword` used to be honoured only by the portal's UI, so anyone
 * holding a one-time password could skip the screen and use the full API — or
 * use the resident and workforce apps, which never showed it. A restricted
 * token now reaches only the routes marked @AllowRestrictedSession (who-am-I,
 * change password, 2FA enrolment, sign-out). Impersonation sessions are exempt:
 * the operator must not be forced to change the community admin's password.
 */
@Injectable()
export class RestrictedSessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user || user.impersonatedBy) return true;
    if (!user.mustChangePassword && !user.mfaSetupRequired) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_RESTRICTED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;
    throw user.mustChangePassword ? new PasswordChangeRequiredException() : new MfaSetupRequiredException();
  }
}
