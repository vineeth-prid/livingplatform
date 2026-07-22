import type { Config } from 'tailwindcss';

/**
 * Living Tailwind preset — maps the design tokens (CSS variables) to Tailwind's
 * theme so utility classes stay on-brand and theme-switch automatically. Apps
 * add this to `presets: [livingPreset]`. Colors resolve to `var(--token)` so
 * light/dark is driven entirely by the `[data-theme]` attribute.
 */
export const livingPreset = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [],
  theme: {
    extend: {
      colors: {
        // Raw scales
        pine: shades('pine', 11),
        stone: shades('stone', 11),
        clay: shades('clay', 10),
        // Semantic surfaces
        page: 'var(--surface-page)',
        raised: 'var(--surface-raised)',
        card: 'var(--surface-card)',
        sunken: 'var(--surface-sunken)',
        tint: 'var(--surface-tint)',
        inverse: 'var(--surface-inverse)',
        // Text
        strong: 'var(--text-strong)',
        body: 'var(--text-body)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        // Brand
        brand: {
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          active: 'var(--brand-primary-active)',
          fg: 'var(--brand-on-primary)',
        },
        accent: {
          DEFAULT: 'var(--brand-accent)',
          hover: 'var(--brand-accent-hover)',
          fg: 'var(--brand-on-accent)',
        },
        // Lines & rings
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        ring: 'var(--ring-focus)',
        // Semantic states
        success: { fg: 'var(--success-fg)', bg: 'var(--success-bg)', solid: 'var(--success-solid)' },
        warning: { fg: 'var(--warning-fg)', bg: 'var(--warning-bg)', solid: 'var(--warning-solid)' },
        danger: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', solid: 'var(--danger-solid)' },
        info: { fg: 'var(--info-fg)', bg: 'var(--info-bg)', solid: 'var(--info-solid)' },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        '2xs': 'var(--text-2xs)',
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        h4: 'var(--text-h4)',
        h3: 'var(--text-h3)',
        h2: 'var(--text-h2)',
        h1: 'var(--text-h1)',
        'display-lg': 'var(--text-display-lg)',
        'display-xl': 'var(--text-display-xl)',
        'display-2xl': 'var(--text-display-2xl)',
      },
      letterSpacing: {
        tighter: 'var(--tracking-tighter)',
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
        wider: 'var(--tracking-wider)',
        widest: 'var(--tracking-widest)',
      },
      lineHeight: {
        none: 'var(--leading-none)',
        tight: 'var(--leading-tight)',
        snug: 'var(--leading-snug)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        pill: 'var(--radius-pill)',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        media: 'var(--radius-media)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        floating: 'var(--shadow-floating)',
        ring: 'var(--ring-focus-shadow)',
      },
      maxWidth: {
        'container-sm': 'var(--container-sm)',
        'container-md': 'var(--container-md)',
        'container-lg': 'var(--container-lg)',
        'container-xl': 'var(--container-xl)',
        'container-2xl': 'var(--container-2xl)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        settle: 'var(--ease-settle)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-base) var(--ease-out)',
        'rise-in': 'rise-in var(--duration-base) var(--ease-out)',
      },
    },
  },
} satisfies Partial<Config>;

function shades(name: string, count: number): Record<string, string> {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].slice(0, count);
  return Object.fromEntries(steps.map((s) => [String(s), `var(--${name}-${s})`]));
}

export default livingPreset;
