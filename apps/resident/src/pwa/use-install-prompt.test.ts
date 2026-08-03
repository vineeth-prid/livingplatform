import { describe, expect, it } from 'vitest';

import { isIos, resolveInstallState, type InstallEnvironment } from './use-install-prompt';

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  ipadOs:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  desktopFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const env = (overrides: Partial<InstallEnvironment>): InstallEnvironment => ({
  userAgent: UA.desktopChrome,
  maxTouchPoints: 0,
  standalone: false,
  supportsPrompt: true,
  ...overrides,
});

describe('isIos', () => {
  it('detects an iPhone', () => {
    expect(isIos(UA.iphoneSafari, 5)).toBe(true);
  });

  it('detects iPadOS masquerading as a Mac (touch points give it away)', () => {
    expect(isIos(UA.ipadOs, 5)).toBe(true);
  });

  it('does not mistake a real Mac for an iPad', () => {
    expect(isIos(UA.ipadOs, 0)).toBe(false);
  });

  it('does not match Android', () => {
    expect(isIos(UA.androidChrome, 5)).toBe(false);
  });
});

describe('resolveInstallState', () => {
  it('reports installed when already running standalone', () => {
    expect(resolveInstallState(env({ standalone: true }))).toBe('installed');
  });

  it('reports installed on iOS standalone too', () => {
    expect(
      resolveInstallState(env({ userAgent: UA.iphoneSafari, maxTouchPoints: 5, standalone: true })),
    ).toBe('installed');
  });

  it('waits for beforeinstallprompt on Chromium', () => {
    expect(resolveInstallState(env({ userAgent: UA.androidChrome, supportsPrompt: true }))).toBe(
      'pending',
    );
  });

  it('offers the manual Share-sheet path on iOS Safari', () => {
    expect(
      resolveInstallState(env({ userAgent: UA.iphoneSafari, maxTouchPoints: 5, supportsPrompt: false })),
    ).toBe('manual-ios');
  });

  it('treats Chrome on iOS as unsupported — it cannot add to the home screen', () => {
    expect(
      resolveInstallState(env({ userAgent: UA.iphoneChrome, maxTouchPoints: 5, supportsPrompt: false })),
    ).toBe('unsupported');
  });

  it('treats desktop Firefox as unsupported', () => {
    expect(resolveInstallState(env({ userAgent: UA.desktopFirefox, supportsPrompt: false }))).toBe(
      'unsupported',
    );
  });

  it('offers the prompt path on desktop Chrome', () => {
    expect(resolveInstallState(env({ userAgent: UA.desktopChrome }))).toBe('pending');
  });

  it('prefers "installed" over every other signal', () => {
    expect(
      resolveInstallState(
        env({ userAgent: UA.iphoneChrome, maxTouchPoints: 5, standalone: true, supportsPrompt: false }),
      ),
    ).toBe('installed');
  });
});
