import { useCallback, useEffect, useState } from 'react';

/**
 * `beforeinstallprompt` is Chromium-only and not in lib.dom yet.
 * https://developer.mozilla.org/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallState =
  /** Chromium fired beforeinstallprompt — we can show a real install button. */
  | 'available'
  /** Already running as an installed app. */
  | 'installed'
  /** iOS Safari: installable, but only through Share → Add to Home Screen. */
  | 'manual-ios'
  /** A browser that cannot install this app (e.g. Firefox on desktop). */
  | 'unsupported'
  /** Chromium that has not fired the event yet — criteria not met, or too early. */
  | 'pending';

const DISMISS_KEY = 'living.install.dismissedAt';
/** How long a dismissal suppresses the banner. */
const DISMISS_DAYS = 14;

export interface InstallPrompt {
  state: InstallState;
  /** True when the app can be installed right now (button or iOS sheet). */
  canInstall: boolean;
  /** True when the banner should be visible (installable and not dismissed). */
  showBanner: boolean;
  /** Trigger the native prompt. Resolves to whether the user accepted. */
  install: () => Promise<boolean>;
  /** Hide the banner for DISMISS_DAYS. */
  dismiss: () => void;
}

/**
 * Everything the app needs to offer "Install Living".
 *
 * Three realities to reconcile:
 *   • Chromium fires `beforeinstallprompt`, which we must capture and replay
 *     later — the event is only usable once and only from a user gesture.
 *   • iOS Safari never fires it; installation is a manual Share-sheet action,
 *     so the UI has to *explain* rather than offer a button.
 *   • Anything already installed must show nothing at all.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>(() => initialState());
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed());

  useEffect(() => {
    if (isStandalone()) {
      setState('installed');
      return;
    }

    const onBeforeInstall = (event: Event) => {
      // Suppress Chrome's own mini-infobar so our banner is the single prompt.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setState('available');
    };
    const onInstalled = () => {
      setDeferred(null);
      setState('installed');
    };
    // Entering standalone without a page load (iOS) still means installed.
    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) setState('installed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event cannot be reused — Chromium re-fires it if the user declines.
    setDeferred(null);
    if (outcome === 'accepted') setState('installed');
    else markDismissed();
    return outcome === 'accepted';
  }, [deferred]);

  const dismiss = useCallback(() => {
    markDismissed();
    setDismissed(true);
  }, []);

  const canInstall = state === 'available' || state === 'manual-ios';
  return { state, canInstall, showBanner: canInstall && !dismissed, install, dismiss };
}

// ── Environment detection ───────────────────────────────────────────────────

/** The browser facts the initial state depends on — passed in so it is testable. */
export interface InstallEnvironment {
  userAgent: string;
  maxTouchPoints: number;
  /** display-mode: standalone, or iOS `navigator.standalone`. */
  standalone: boolean;
  /** Chromium exposes `onbeforeinstallprompt` on window. */
  supportsPrompt: boolean;
}

/** Already launched from the home screen / app window? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/** iOS/iPadOS — installable, but only via the Share sheet. */
export function isIos(ua: string = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  // iPadOS 13+ reports as Macintosh; touch points disambiguate it.
  const iPadOs = /Macintosh/.test(ua) && touchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

/**
 * Decide what install affordance (if any) to offer. Pure — every branch here is
 * a real device family, so it is covered directly by use-install-prompt.test.ts.
 */
export function resolveInstallState(env: InstallEnvironment): InstallState {
  if (env.standalone) return 'installed';
  if (isIos(env.userAgent, env.maxTouchPoints)) {
    // Only Safari can add to the home screen. Chrome/Firefox on iOS and in-app
    // browsers (Instagram, Gmail) cannot, so offering a button would dead-end.
    const isSafari = /Safari/.test(env.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(env.userAgent);
    return isSafari ? 'manual-ios' : 'unsupported';
  }
  return env.supportsPrompt ? 'pending' : 'unsupported';
}

function initialState(): InstallState {
  if (typeof window === 'undefined') return 'unsupported';
  return resolveInstallState({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
    supportsPrompt: 'onbeforeinstallprompt' in window,
  });
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled — the banner simply reappears.
  }
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
