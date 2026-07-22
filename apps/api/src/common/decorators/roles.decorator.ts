import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'requiredRoles';

/**
 * Requires the caller to hold at least one of the given role keys.
 * Coarser than permissions — prefer @RequirePermissions for feature gating and
 * reserve @Roles for broad role checks.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
