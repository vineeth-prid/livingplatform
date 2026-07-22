import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, Permission, Session } from '@living/types';

import { qk } from './query-keys';
import { useLiving } from './sdk-context';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  session: Session | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: Permission) => boolean;
  hasAnyPermission: (perms: Permission[]) => boolean;
  hasAllPermissions: (perms: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The authentication + authorization source of truth. Session identity comes
 * from `/auth/me`; roles/permissions are decoded from the access token (which
 * already carries them), so permission checks are synchronous and local.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const living = useLiving();
  const queryClient = useQueryClient();
  const [tokenPresent, setTokenPresent] = useState(() => living.isAuthenticated());

  const sessionQuery = useQuery<Session | null>({
    queryKey: qk.session,
    enabled: tokenPresent,
    staleTime: Infinity,
    queryFn: async () => {
      const payload = living.getTokenPayload();
      if (!payload) return null;
      const user = await living.auth.me();
      return {
        user,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions,
        accessTokenExpiresAt: new Date(payload.exp * 1000).toISOString(),
      };
    },
  });

  const login = useCallback(
    async (input: LoginInput) => {
      await living.auth.login(input);
      setTokenPresent(true);
      await queryClient.invalidateQueries({ queryKey: qk.session });
    },
    [living, queryClient],
  );

  const logout = useCallback(async () => {
    await living.auth.logout();
    setTokenPresent(false);
    queryClient.setQueryData(qk.session, null);
    queryClient.clear();
  }, [living, queryClient]);

  const session = sessionQuery.data ?? null;
  const permSet = useMemo(
    () => new Set(session?.permissions ?? []),
    [session?.permissions],
  );

  const hasPermission = useCallback((p: Permission) => permSet.has(p), [permSet]);
  const hasAnyPermission = useCallback(
    (ps: Permission[]) => ps.some((p) => permSet.has(p)),
    [permSet],
  );
  const hasAllPermissions = useCallback(
    (ps: Permission[]) => ps.every((p) => permSet.has(p)),
    [permSet],
  );

  const status: AuthStatus = !tokenPresent
    ? 'unauthenticated'
    : sessionQuery.isLoading
      ? 'loading'
      : session
        ? 'authenticated'
        : 'unauthenticated';

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      logout,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [session, status, login, logout, hasPermission, hasAnyPermission, hasAllPermissions],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
