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

/** Undo the stash if the swap failed. */
export function cancelImpersonation(): void {
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
