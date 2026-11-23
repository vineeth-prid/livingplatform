import type { ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { cn } from '@living/utils';

interface LoginBrand {
  name?: string | null;
  logoUrl?: string | null;
}

/**
 * The sign-in screen every app shares: the community's logo and colours (from
 * the cached theme tokens), a softly animated backdrop — drifting colour
 * blobs, clouds and a little skyline whose windows light up — and a centred
 * column so the logo, heading, text and form all sit on one axis.
 *
 * `split` (the admin portal) adds a brand panel on large screens. Every loop is
 * CSS behind `motion-safe`, and Framer follows the OS reduced-motion setting.
 */
export function LoginShell({
  brand,
  title,
  subtitle,
  eyebrow,
  split = false,
  children,
}: {
  brand?: LoginBrand | null;
  title: string;
  subtitle: string;
  /** Small label above the title, e.g. "Residents". */
  eyebrow?: string;
  split?: boolean;
  children: ReactNode;
}) {
  const name = brand?.name || 'Living';
  const branded = !!brand?.name;
  const rise = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <MotionConfig reducedMotion="user">
      <style>{KEYFRAMES}</style>
      <div className={cn('relative min-h-dvh overflow-hidden bg-page', split && 'lg:grid lg:grid-cols-[1.1fr_1fr]')}>
        {split && (
          <aside style={{ background: PANEL, color: ON_PANEL }} className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 lg:pb-32">
            <Backdrop onBrand />
            <motion.div {...rise(0)} className="relative">
              <Logo brand={brand} large />
            </motion.div>
            <motion.div {...rise(1)} className="relative max-w-md">
              <p className="text-2xs font-semibold uppercase tracking-[0.2em] opacity-70">
                {branded ? 'Community admin' : 'Living platform'}
              </p>
              <h1 className="mt-3 font-display text-display-lg leading-[1.05] tracking-tight">
                {branded ? `Welcome to ${name}.` : 'Life Happens Here.'}
              </h1>
              <p className="mt-4 text-lg opacity-80">
                {branded ? 'Run your community — residents, gate, services and billing — in one calm place.' : 'A calm operating system for residential communities.'}
              </p>
            </motion.div>
            <p className="relative text-2xs uppercase tracking-wider opacity-60">
              {branded ? `${name} · powered by Living` : 'Living · Since 2024'}
            </p>
          </aside>
        )}

        <main className="relative flex min-h-dvh items-center justify-center px-5 pb-28 pt-10">
          <Backdrop />
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
            <motion.div {...rise(0)} className={cn(split && 'lg:hidden')}>
              <Logo brand={brand} />
            </motion.div>
            {eyebrow && (
              <motion.p {...rise(1)} className="mt-6 rounded-full bg-card/70 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.18em] text-brand shadow-sm ring-1 ring-border-subtle backdrop-blur">
                {eyebrow}
              </motion.p>
            )}
            <motion.h2 {...rise(2)} className={cn('font-display text-[2.25rem] leading-[1.1] tracking-tight text-strong', eyebrow ? 'mt-3' : 'mt-6')}>
              {title}
            </motion.h2>
            <motion.p {...rise(3)} className="mt-2 max-w-xs text-balance text-muted">
              {subtitle}
            </motion.p>

            <motion.div
              {...rise(4)}
              className="mt-7 w-full rounded-3xl bg-card/85 p-6 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] ring-1 ring-border-subtle backdrop-blur-md"
            >
              {children}
            </motion.div>

            <motion.p {...rise(5)} className="mt-6 text-xs text-subtle">
              {branded ? (
                <>{name} · powered by <span className="font-semibold">Living</span></>
              ) : (
                'Life Happens Here.'
              )}
            </motion.p>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}

/** Community logo on a white tile (logos are often JPGs with a white ground), or the Living word mark. */
function Logo({ brand, large }: { brand?: LoginBrand | null; large?: boolean }) {
  if (brand?.logoUrl) {
    return (
      <div className={cn('ls-float inline-flex rounded-3xl bg-white shadow-lg ring-1 ring-black/5', large ? 'p-4' : 'p-3')}>
        <img
          src={brand.logoUrl}
          alt={brand.name ? `${brand.name} logo` : 'Community logo'}
          className={cn('w-auto object-contain', large ? 'h-24 max-w-[240px]' : 'h-20 max-w-[200px]')}
        />
      </div>
    );
  }
  return (
    <span className={cn('ls-float inline-flex items-center gap-2 font-display tracking-tight', large ? 'text-3xl' : 'text-3xl text-strong')}>
      <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl shadow-md" />
      Living<span className="text-accent">.</span>
    </span>
  );
}

/**
 * Decorative, aria-hidden. Colours come from the theme tokens, so it follows
 * the community; `onBrand` draws in the text colour that reads on the primary.
 */
function Backdrop({ onBrand }: { onBrand?: boolean }) {
  const ink = onBrand ? ON_PANEL : 'var(--brand-primary)';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {!onBrand && (
        <>
          <div className="ls-blob absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--brand-primary)' }} />
          <div className="ls-blob ls-blob-2 absolute -right-20 top-1/4 h-64 w-64 rounded-full opacity-[0.12] blur-3xl" style={{ background: 'var(--brand-accent)' }} />
          <div className="ls-blob ls-blob-3 absolute bottom-10 left-1/4 h-72 w-72 rounded-full opacity-60 blur-3xl" style={{ background: 'var(--brand-secondary)' }} />
        </>
      )}
      <Cloud className="ls-cloud absolute top-[3%] h-8" color={ink} />
      <Cloud className="ls-cloud ls-cloud-2 absolute top-[7%] h-5" color={ink} />
      <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-20 w-full" style={{ opacity: onBrand ? 0.14 : 0.08 }}>
        {BUILDINGS.map(([x, w, h], i) => (
          <rect key={i} x={x} y={120 - h} width={w} height={h} rx={2} fill={ink} />
        ))}
      </svg>
      <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-20 w-full">
        {WINDOWS.map(([x, y], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={3.5}
            height={4}
            rx={0.8}
            className="ls-window"
            style={{ fill: i % 4 ? ink : 'var(--brand-accent)', animationDelay: `${(i * 0.73) % 6}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

function Cloud({ className, color }: { className: string; color: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} style={{ opacity: 0.12 }}>
      <path d="M14 22h38a10 10 0 0 0 0-20 13 13 0 0 0-24 3A9 9 0 0 0 14 22z" fill={color} />
    </svg>
  );
}

// The community's true primary (Living green without a theme), in light and dark mode alike.
const PANEL = 'var(--brand-panel, var(--pine-800))';
const ON_PANEL = 'var(--brand-on-panel, var(--stone-50))';

// [x, width, height] of the skyline blocks, and the windows that light up on them.
const BUILDINGS: [number, number, number][] = [
  [8, 34, 58], [46, 26, 86], [76, 40, 46], [120, 30, 100], [154, 44, 64], [202, 24, 80],
  [230, 48, 52], [282, 30, 94], [316, 38, 60], [358, 34, 76],
];
const WINDOWS: [number, number][] = BUILDINGS.flatMap(([x, w, h]) =>
  Array.from({ length: Math.floor(h / 18) }, (_, r) => [
    [x + 6, 120 - h + 8 + r * 16],
    [x + w - 10, 120 - h + 8 + r * 16],
  ] as [number, number][]).flat(),
);

const KEYFRAMES = `
@media (prefers-reduced-motion: no-preference) {
  .ls-float { animation: ls-float 6s ease-in-out infinite; }
  .ls-blob { animation: ls-drift 18s ease-in-out infinite alternate; }
  .ls-blob-2 { animation-duration: 22s; animation-direction: alternate-reverse; }
  .ls-blob-3 { animation-duration: 26s; }
  .ls-cloud { animation: ls-cloud 38s linear infinite; }
  .ls-cloud-2 { animation-duration: 55s; animation-delay: -20s; }
  .ls-window { animation: ls-twinkle 6s ease-in-out infinite; }
}
.ls-cloud { left: -10%; }
.ls-window { opacity: .2; }
@keyframes ls-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes ls-drift { from { transform: translate(0,0) scale(1) } to { transform: translate(40px,30px) scale(1.15) } }
@keyframes ls-cloud { from { left: -15% } to { left: 110% } }
@keyframes ls-twinkle { 0%,100% { opacity: .08 } 40%,60% { opacity: .6 } }
`;
