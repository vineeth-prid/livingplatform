import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';

/** Permission enforcement — the caller must hold EVERY required permission. */
describe('PermissionsGuard', () => {
  const makeContext = (permissions: string[] | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => (permissions ? { user: { permissions } } : {}),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const makeGuard = (required: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  };

  it('allows when no permissions are required', () => {
    expect(makeGuard(undefined).canActivate(makeContext(['x']))).toBe(true);
  });

  it('allows when the user holds all required permissions', () => {
    const guard = makeGuard(['unit:read', 'unit:create']);
    const ctx = makeContext(['unit:read', 'unit:create', 'community:read']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('forbids when a required permission is missing', () => {
    const guard = makeGuard(['unit:delete']);
    const ctx = makeContext(['unit:read']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('forbids an unauthenticated request', () => {
    const guard = makeGuard(['unit:read']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
