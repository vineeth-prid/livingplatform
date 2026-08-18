import { living } from '../../lib/living';

/**
 * "Log in as community admin" support. A Platform Admin's own tokens are stashed
 * client-side before the session is swapped to a community admin, so a banner
 * can restore them (Exit) without re-authenticating. The stash lives in
 * localStorage keyed separately from the active session tokens.
 */
const KEY = 'living.impersonation';

interface Stash {
  communityName: string;
  platform: { accessToken: string; refreshToken: string };
}

/** Capture the platform-admin tokens before swapping to a community session. */
export function beginImpersonation(communityName: string): void {
  const accessToken = living.tokenStore.getAccess();
  const refreshToken = living.tokenStore.getRefresh();
  if (accessToken && refreshToken) {
    const stash: Stash = { communityName, platform: { accessToken, refreshToken } };
    localStorage.setItem(KEY, JSON.stringify(stash));
  }
}

/**
 * Undo a failed swap — and put the platform-admin tokens back.
 *
 * `loginAsCommunity` replaces the client's tokens as part of its own call, so by
 * the time anything downstream can fail the session is ALREADY a community
 * admin's. Only clearing the stash left the platform admin holding a community
 * session on the platform-admin page: the community list then returned just
 * that one community, and "Log in as admin" answered 403 — which is the
 * "no other communities listed, button stuck" state. Restoring is the whole
 * point of having stashed them.
 */
export function cancelImpersonation(): void {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const { platform } = JSON.parse(raw) as Stash;
      if (platform?.accessToken && platform?.refreshToken) {
        living.tokenStore.set(platform);
      }
    } catch {
      /* nothing to restore */
    }
  }
  localStorage.removeItem(KEY);
}

/** The community name currently being impersonated, or null. */
export function getImpersonation(): string | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Stash).communityName;
  } catch {
    return null;
  }
}

/** Restore the platform-admin session and return to the control plane. */
export function exitImpersonation(): void {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const { platform } = JSON.parse(raw) as Stash;
      if (platform?.accessToken && platform?.refreshToken) {
        living.tokenStore.set(platform);
      }
    } catch {
      /* fall through — nothing to restore */
    }
    localStorage.removeItem(KEY);
  }
  window.location.assign('/admin/communities');
}
