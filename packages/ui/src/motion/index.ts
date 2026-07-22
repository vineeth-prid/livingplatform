import type { Transition, Variants } from 'framer-motion';

/**
 * The single motion library. Durations/easings mirror the design tokens.
 * Every variant is calm and purposeful — motion improves usability, never
 * decorates. Components should pair these with `useReducedMotion()` (see
 * `reduce()`), and Framer also honours the OS reduced-motion setting.
 */

export const DURATION = {
  fast: 0.14,
  base: 0.22,
  slow: 0.32,
} as const;

type Bezier = [number, number, number, number];
export const EASE = {
  standard: [0.2, 0, 0, 1] as Bezier,
  out: [0.16, 1, 0.3, 1] as Bezier,
  in: [0.6, 0, 0.9, 0.2] as Bezier,
  settle: [0.34, 1.16, 0.64, 1] as Bezier,
};

export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE.out },
  base: { duration: DURATION.base, ease: EASE.out },
  settle: { duration: DURATION.base, ease: EASE.settle },
} satisfies Record<string, Transition>;

/** Fade only. */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
};

/** Fade + gentle rise — page/section entrances. */
export const fadeRise: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: 4, transition: transitions.fast },
};

/** Dialog: soft scale + rise over a scrim. */
export const dialogContent: Variants = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transitions.settle },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: transitions.fast },
};

export const scrim: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
};

/** Drawer/sheet slide from a side. */
export function drawer(side: 'left' | 'right' | 'bottom' = 'right'): Variants {
  const axis = side === 'bottom' ? 'y' : 'x';
  const from = side === 'left' ? '-100%' : '100%';
  return {
    initial: { [axis]: from },
    animate: { [axis]: 0, transition: { duration: DURATION.slow, ease: EASE.out } },
    exit: { [axis]: from, transition: { duration: DURATION.base, ease: EASE.in } },
  } as Variants;
}

/** Staggered list container + item. */
export const listContainer: Variants = {
  animate: { transition: { staggerChildren: 0.03 } },
};
export const listItem: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
};

/** Interactive press (buttons/cards): scale to 0.98, no color flash. */
export const press = { whileTap: { scale: 0.98 }, transition: transitions.fast } as const;

/** Collapse a variant set to instant when reduced motion is requested. */
export function reduce(variants: Variants, reduced: boolean): Variants {
  if (!reduced) return variants;
  const zero: Transition = { duration: 0 };
  const strip = (v: unknown) =>
    typeof v === 'object' && v ? { ...(v as object), transition: zero } : v;
  return Object.fromEntries(
    Object.entries(variants).map(([k, v]) => [k, strip(v)]),
  ) as Variants;
}
