import { type ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '@living/hooks';
import { LoadingState } from '@living/ui';
import type { Permission } from '@living/types';

/** Gate a subtree behind authentication. Redirects to /login when signed out. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingState className="h-dvh" label="Signing you in…" />;
  if (status === 'unauthenticated') return <Navigate to="/login" />;
  return <>{children}</>;
}

/** Gate a subtree behind one or more permissions. */
export function RequirePermission({
  perm,
  children,
  fallback,
}: {
  perm: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasAnyPermission } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!hasAnyPermission(perms)) {
    return (
      <>{fallback ?? <div className="p-10 text-center text-muted">You don’t have access to this area.</div>}</>
    );
  }
  return <>{children}</>;
}
