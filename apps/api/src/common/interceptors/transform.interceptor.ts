import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Wraps every successful response in a consistent `{ success, data }` envelope
 * so clients get a stable shape. Routes marked @SkipTransform() (e.g. the
 * Prometheus /metrics text endpoint) pass through untouched. Errors go through
 * AllExceptionsFilter and use their own shape.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();
    return next.handle().pipe(map((data) => ({ success: true as const, data })));
  }
}
