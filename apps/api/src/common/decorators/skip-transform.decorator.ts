import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Opt a route out of the `{ success, data }` response envelope — for endpoints
 * that must return a raw body (e.g. Prometheus text at /metrics).
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
