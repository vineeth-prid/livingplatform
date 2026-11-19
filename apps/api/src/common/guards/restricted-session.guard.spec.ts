import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import {
  AllowRestrictedSession,
  MfaSetupRequiredException,
  PasswordChangeRequiredException,
  RestrictedSessionGuard,
} from './restricted-session.guard';

class Routes {
  @AllowRestrictedSession()
  changePassword() {}
  invoices() {}
}

function ctx(user: object | undefined, handler: () => void): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

describe('RestrictedSessionGuard', () => {
  const guard = new RestrictedSessionGuard(new Reflector());
  const routes = new Routes();

  it('lets normal sessions through', () => {
    expect(guard.canActivate(ctx({ id: 'u' }, routes.invoices))).toBe(true);
  });

  it('blocks a one-time-password session from ordinary routes', () => {
    expect(() => guard.canActivate(ctx({ id: 'u', mustChangePassword: true }, routes.invoices)))
      .toThrow(PasswordChangeRequiredException);
  });

  it('allows the change-password route', () => {
    expect(guard.canActivate(ctx({ id: 'u', mustChangePassword: true }, routes.changePassword))).toBe(true);
  });

  it('blocks an un-enrolled session when 2FA is required', () => {
    expect(() => guard.canActivate(ctx({ id: 'u', mfaSetupRequired: true }, routes.invoices)))
      .toThrow(MfaSetupRequiredException);
  });

  it('exempts impersonation sessions and public routes', () => {
    expect(
      guard.canActivate(ctx({ id: 'u', mustChangePassword: true, impersonatedBy: { id: 'p' } }, routes.invoices)),
    ).toBe(true);
    expect(guard.canActivate(ctx(undefined, routes.invoices))).toBe(true);
  });
});
