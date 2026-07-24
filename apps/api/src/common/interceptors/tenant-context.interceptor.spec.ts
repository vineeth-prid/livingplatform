import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { getTenantStore, tenantAls } from '../context/tenant-als';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import type { AuthenticatedUser } from '../types/authenticated-user';

function ctxFor(user?: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}
const next: CallHandler = { handle: () => of('ok') };

describe('TenantContextInterceptor', () => {
  const interceptor = new TenantContextInterceptor();

  it('scopes a tenant user to their tenant (no bypass)', () => {
    tenantAls.run({ tenantId: null, bypass: false }, () => {
      interceptor.intercept(ctxFor({ tenantId: 't1', roles: [{ key: 'assoc', scope: 'COMMUNITY', communityId: null }] }), next);
      expect(getTenantStore()).toEqual({ tenantId: 't1', bypass: false });
    });
  });

  it('bypasses for a platform-scoped principal', () => {
    tenantAls.run({ tenantId: null, bypass: false }, () => {
      interceptor.intercept(ctxFor({ tenantId: null, roles: [{ key: 'platform', scope: 'PLATFORM', communityId: null }] }), next);
      expect(getTenantStore()).toEqual({ tenantId: null, bypass: true });
    });
  });

  it('leaves no store for unauthenticated requests', () => {
    tenantAls.run(undefined as never, () => {
      interceptor.intercept(ctxFor(undefined), next);
      expect(getTenantStore()).toBeUndefined();
    });
  });
});
