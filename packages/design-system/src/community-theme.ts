/**
 * Community white-label theme → CSS custom properties.
 *
 * One function for every app: it writes a single <style id="community-theme">
 * that overrides the design tokens, so every component that already reads
 * `--brand-primary`, `--surface-page`, `--font-sans`… follows the community
 * without knowing it exists. No theme = the element is removed = Living.
 *
 * Contrast is enforced, not trusted: text colours that would be unreadable on
 * the chosen background are dropped, the text on a primary button is whichever
 * of white/ink reads better, and dark mode uses a lightened primary so it stays
 * visible on a dark page. Status colours (success/warning/danger) are never
 * touched — their meaning must not depend on a community's palette.
 */
export interface CommunityTheme {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  textPrimary?: string;
  textSecondary?: string;
  fontFamily?: 'geist' | 'lexend';
  headingWeight?: number;
  bodyWeight?: number;
}

const FONTS: Record<NonNullable<CommunityTheme['fontFamily']>, string> = {
  geist: '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  lexend: '"Lexend Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const STORE_KEY = 'living.community-theme';
const STYLE_ID = 'community-theme';
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const INK = '#111111';
const DARK_PAGE = '#100e0c';

const rgb = (hex: string): [number, number, number] => {
  const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
/** WCAG contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
const mix = (a: string, b: string, t: number) => {
  const [p, q] = [rgb(a), rgb(b)];
  return `#${p.map((v, i) => Math.round(v + (q[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
const readableOn = (bg: string) => (contrast('#ffffff', bg) >= contrast(INK, bg) ? '#ffffff' : INK);
const ok = (v?: string): v is string => !!v && HEX.test(v);

/** The CSS for a theme (exported for tests). Empty string = nothing to override. */
export function themeCss(t: CommunityTheme | null | undefined): string {
  if (!t) return '';
  const light: string[] = [];
  const dark: string[] = [];
  const page = ok(t.background) ? t.background : '#faf8f4';

  if (ok(t.primary)) {
    light.push(
      `--brand-primary:${t.primary}`,
      `--brand-primary-hover:${mix(t.primary, '#000000', 0.12)}`,
      `--brand-primary-active:${mix(t.primary, '#000000', 0.22)}`,
      `--brand-on-primary:${readableOn(t.primary)}`,
    );
    // Lighten until it reads on the dark page (≥ 4.5:1), so dark mode keeps the brand hue.
    let d = t.primary;
    for (let i = 1; contrast(d, DARK_PAGE) < 4.5 && i <= 10; i++) d = mix(t.primary, '#ffffff', i / 10);
    dark.push(
      `--brand-primary:${d}`,
      `--brand-primary-hover:${mix(d, '#ffffff', 0.12)}`,
      `--brand-primary-active:${mix(d, '#ffffff', 0.22)}`,
      `--brand-on-primary:${readableOn(d)}`,
    );
  }
  if (ok(t.accent)) {
    light.push(`--brand-accent:${t.accent}`, `--brand-accent-hover:${mix(t.accent, '#000000', 0.12)}`, `--brand-on-accent:${readableOn(t.accent)}`);
  }
  if (ok(t.secondary)) light.push(`--brand-secondary:${mix(t.secondary, '#ffffff', 0.8)}`);
  if (ok(t.background)) light.push(`--surface-page:${t.background}`);
  if (ok(t.surface)) light.push(`--surface-raised:${t.surface}`, `--surface-card:${t.surface}`);
  // Text only where it stays readable on the page it sits on.
  if (ok(t.textPrimary) && contrast(t.textPrimary, page) >= 4.5) {
    light.push(`--text-strong:${t.textPrimary}`, `--text-body:${mix(t.textPrimary, page, 0.12)}`);
  }
  if (ok(t.textSecondary) && contrast(t.textSecondary, page) >= 4.5) light.push(`--text-muted:${t.textSecondary}`);

  const shared: string[] = [];
  if (t.fontFamily && FONTS[t.fontFamily]) shared.push(`--font-sans:${FONTS[t.fontFamily]}`);
  if (t.bodyWeight) shared.push(`--fw-regular:${t.bodyWeight}`);
  // Brand panels (sign-in) wear the true primary in both modes, not the dark-mode tint.
  if (ok(t.primary)) shared.push(`--brand-panel:${t.primary}`, `--brand-on-panel:${readableOn(t.primary)}`);

  // html-qualified selectors outrank the token sheet's bare :root / [data-theme].
  let css = '';
  if (light.length + shared.length) css += `html:not([data-theme="dark"]){${[...light, ...shared].join(';')}}`;
  if (dark.length + shared.length) css += `html[data-theme="dark"]{${[...dark, ...shared].join(';')}}`;
  if (t.headingWeight) css += `.font-display,h1,h2,h3{font-weight:${t.headingWeight}}`;
  if (ok(t.primary)) {
    // The admin side panel wears the brand colour (light mode). Every colour
    // token is re-derived inside it from the primary and the text that reads
    // on it, so its links, hover, active item and switcher stay legible with
    // no component knowing about the theme.
    const p = t.primary;
    const fg = readableOn(p);
    css += `html:not([data-theme="dark"]) [data-sidebar]{background-color:${p};border-color:${mix(p, fg, 0.12)};`
      + `--surface-raised:${mix(p, fg, 0.08)};--surface-card:${mix(p, fg, 0.08)};--surface-sunken:${mix(p, fg, 0.12)};`
      + `--surface-tint:${mix(p, fg, 0.2)};--text-on-tint:${fg};--text-strong:${fg};--text-body:${mix(fg, p, 0.08)};`
      + `--text-muted:${mix(fg, p, 0.25)};--text-subtle:${mix(fg, p, 0.35)};--border-subtle:${mix(p, fg, 0.16)};`
      + `--border-default:${mix(p, fg, 0.24)};--brand-primary:${fg};--brand-on-primary:${p}}`;
  }
  return css;
}

function write(css: string) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID);
  if (!css) return el?.remove();
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

/** Apply (and remember for the next launch) a community theme; null = Living. */
export function applyCommunityTheme(theme: CommunityTheme | null | undefined): void {
  const css = themeCss(theme);
  write(css);
  try {
    if (css) localStorage.setItem(STORE_KEY, css);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode — the theme still applies for this session */
  }
}

/**
 * Re-apply the last theme synchronously at startup, before React renders, so
 * a branded app never flashes Living green first. Call at the top of main.tsx.
 */
export function bootCommunityTheme(): void {
  try {
    write(localStorage.getItem(STORE_KEY) ?? '');
  } catch {
    /* no storage — Living until the branding loads */
  }
}
