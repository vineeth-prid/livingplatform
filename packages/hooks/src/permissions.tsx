import type { ReactNode } from 'react';
import type { Permission } from '@living/types';

import { useAuth } from './auth';

/** Ergonomic permission checks derived from the current session. */
export function usePermissions() {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  return { has: hasPermission, hasAny: hasAnyPermission, hasAll: hasAllPermissions };
}

/**
 * Conditional render by permission. Provide exactly one of `perm` / `any` / `all`.
 *   <Can perm="ticket:create"><NewTicketButton /></Can>
 */
export function Can({
  perm,
  any,
  all,
  fallback = null,
  children,
}: {
  perm?: Permission;
  any?: Permission[];
  all?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const allowed = perm
    ? hasPermission(perm)
    : any
      ? hasAnyPermission(any)
      : all
        ? hasAllPermissions(all)
        : true;
  return <>{allowed ? children : fallback}</>;
}
