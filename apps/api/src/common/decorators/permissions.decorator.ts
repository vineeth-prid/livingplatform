import { SetMetadata } from '@nestjs/common';

import type { PermissionKey } from '../../modules/rbac/rbac.constants';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Requires the caller to hold ALL of the given permissions. Permission strings
 * are the typed catalog keys, so a typo fails at compile time.
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
