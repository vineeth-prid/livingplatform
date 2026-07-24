import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Auth bodies carry secrets — never snapshot these paths' payloads.
const SENSITIVE = /\/auth\/(login|register|refresh|reset-password|forgot-password)/;

/**
 * Records every successful mutating request to the audit trail. Reads writes
 * (GET) are skipped to keep the log signal-rich. The action string is derived
 * from the route so new modules are covered automatically, with no per-handler
 * wiring.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!MUTATING.has(req.method)) return next.handle();

    const res = context.switchToHttp().getResponse<Response>();
    const user = req.user as AuthenticatedUser | undefined;
    const { resource, action } = this.describe(req);

    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          action,
          resource,
          actorId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          tenantId: user?.tenantId ?? null,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          // On an impersonation session, record the real operator behind the
          // acting community admin so the timeline stays honest.
          metadata: user?.impersonatedBy
            ? { impersonatedBy: { id: user.impersonatedBy.id, email: user.impersonatedBy.email } }
            : undefined,
        });
      }),
    );
  }

  /** Turn `POST /api/v1/users/123/status` into resource=users, action=users.create. */
  private describe(req: Request): { resource: string; action: string } {
    const segments = req.path.split('/').filter(Boolean);
    // Drop api prefix + version segments (e.g. "api", "v1").
    const meaningful = segments.filter((s) => s !== 'api' && !/^v\d+$/.test(s));
    const resource = meaningful[0] ?? 'unknown';
    const verb =
      { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[
        req.method
      ] ?? req.method.toLowerCase();
    const suffix = SENSITIVE.test(req.path)
      ? (req.path.split('/').pop() ?? verb)
      : verb;
    return { resource, action: `${resource}.${suffix}` };
  }
}
