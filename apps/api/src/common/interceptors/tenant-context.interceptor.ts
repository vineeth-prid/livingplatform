import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { tenantAls } from '../context/tenant-als';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Seeds the request's tenant context (AsyncLocalStorage) from the authenticated
 * principal so the Prisma RLS extension can scope queries. Runs after the auth
 * guard (interceptors execute after guards), so `request.user` is populated.
 *
 * Platform principals bypass tenant scoping; unauthenticated/public requests set
 * no store (the extension treats a missing store as bypass).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (user) {
      const bypass = (user.roles ?? []).some((r) => r.scope === 'PLATFORM');
      // enterWith sets the store for the remainder of this request's async context.
      tenantAls.enterWith({ tenantId: user.tenantId ?? null, bypass });
    }
    return next.handle();
  }
}
