import type { ApiErrorBody } from '@living/types';

/** Normalized error thrown by every SDK call on a non-2xx response. */
export class LivingApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly raw: unknown;

  constructor(statusCode: number, message: string, error: string, raw?: unknown) {
    super(message);
    this.name = 'LivingApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.raw = raw;
  }

  static fromBody(status: number, body: unknown): LivingApiError {
    const b = (body ?? {}) as Partial<ApiErrorBody>;
    const message = Array.isArray(b.message)
      ? b.message.join(', ')
      : (b.message ?? b.error ?? 'Request failed');
    return new LivingApiError(status, message, b.error ?? 'Error', body);
  }

  get isAuthError(): boolean {
    return this.statusCode === 401;
  }
  get isForbidden(): boolean {
    return this.statusCode === 403;
  }
  get isNotFound(): boolean {
    return this.statusCode === 404;
  }
  get isValidation(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }
}
