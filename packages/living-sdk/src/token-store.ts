import type { AccessTokenPayload } from '@living/types';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/** Pluggable token persistence — the SDK never assumes a browser. */
export interface TokenStore {
  getAccess(): string | null;
  getRefresh(): string | null;
  set(tokens: StoredTokens): void;
  clear(): void;
}

/** Browser localStorage store (survives reloads). */
export function createLocalStorageTokenStore(prefix = 'living'): TokenStore {
  const A = `${prefix}.accessToken`;
  const R = `${prefix}.refreshToken`;
  return {
    getAccess: () => localStorage.getItem(A),
    getRefresh: () => localStorage.getItem(R),
    set: ({ accessToken, refreshToken }) => {
      localStorage.setItem(A, accessToken);
      localStorage.setItem(R, refreshToken);
    },
    clear: () => {
      localStorage.removeItem(A);
      localStorage.removeItem(R);
    },
  };
}

/** In-memory store (SSR / tests). */
export function createMemoryTokenStore(): TokenStore {
  let tokens: StoredTokens | null = null;
  return {
    getAccess: () => tokens?.accessToken ?? null,
    getRefresh: () => tokens?.refreshToken ?? null,
    set: (t) => {
      tokens = t;
    },
    clear: () => {
      tokens = null;
    },
  };
}

/** Decode a JWT access token payload (roles/permissions/expiry) — no verification. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
