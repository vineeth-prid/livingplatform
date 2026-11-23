import { describe, expect, it } from 'vitest';
import { contrast, themeCss } from '@living/design-system';

/** The Skyline palette, measured from the client's website screenshots. */
const skyline = {
  primary: '#002A44', secondary: '#33C4ED', accent: '#EF3F35', background: '#F4F7F9', surface: '#FFFFFF',
  textPrimary: '#0B1B26', textSecondary: '#52626E', fontFamily: 'lexend' as const, headingWeight: 600, bodyWeight: 400,
};

describe('community theme → CSS tokens', () => {
  it('no theme = no overrides (the Living theme stays untouched)', () => {
    expect(themeCss(null)).toBe('');
    expect(themeCss({})).toBe('');
  });

  it('maps the palette onto the design tokens, with readable text on the primary', () => {
    const css = themeCss(skyline);
    expect(css).toContain('--brand-primary:#002A44');
    expect(css).toContain('--brand-on-primary:#ffffff');
    expect(css).toContain('--brand-panel:#002A44');
    expect(css).toContain('--surface-page:#F4F7F9');
    expect(css).toContain('--font-sans:"Lexend Variable"');
    expect(css).toContain('.font-display,h1,h2,h3{font-weight:600}');
  });

  it('dark mode gets a lightened primary that reads on the dark page', () => {
    const dark = /html\[data-theme="dark"\]\{[^}]*--brand-primary:(#[0-9a-f]{6})/.exec(themeCss(skyline))![1]!;
    expect(contrast(dark, '#100e0c')).toBeGreaterThanOrEqual(4.5);
  });

  it('drops text colours that would be unreadable on the background', () => {
    const css = themeCss({ background: '#ffffff', textPrimary: '#f0f0f0', textSecondary: '#eeeeee' });
    expect(css).not.toContain('--text-strong');
    expect(css).not.toContain('--text-muted');
  });

  it('colours the side panel with the primary, with readable text on it', () => {
    const css = themeCss(skyline);
    const panel = /\[data-sidebar\]\{([^}]*)\}/.exec(css)![1]!;
    expect(panel).toContain('background-color:#002A44');
    const text = /--text-strong:(#[0-9a-f]{6})/i.exec(panel)![1]!;
    const muted = /--text-subtle:(#[0-9a-f]{6})/i.exec(panel)![1]!;
    expect(contrast(text, '#002A44')).toBeGreaterThanOrEqual(7);
    expect(contrast(muted, '#002A44')).toBeGreaterThanOrEqual(4.5);
  });

  it('never touches status colours', () => {
    expect(themeCss(skyline)).not.toMatch(/--(success|warning|danger|info)/);
  });

  it('ignores malformed colours', () => {
    expect(themeCss({ primary: 'red; } body { display:none' })).toBe('');
  });
});
