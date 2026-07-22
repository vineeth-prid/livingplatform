import { type ComponentType } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { StatCard } from '@living/ui';

import { AnimatedCounter } from './animated-counter';

export interface KpiCardProps {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  href: string;
  /** Emphasis tone — draws a hairline accent when the number is non-zero. */
  tone?: 'default' | 'warning' | 'danger';
}

/**
 * Clickable KPI: reuses the shared StatCard, adds an animated counter, a
 * navigation link, and a calm hover lift. Composition — not a new component.
 * The icon chip lights up in its tone only when the number warrants attention.
 */
export function KpiCard({ label, value, icon, href, tone = 'default' }: KpiCardProps) {
  const reduced = useReducedMotion();
  const emphasize = tone !== 'default' && value > 0;
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -3 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={href}
        aria-label={`${label}: ${value}`}
        className="block rounded-card focus-visible:outline-none focus-visible:shadow-ring"
      >
        <StatCard
          label={label}
          value={<AnimatedCounter value={value} />}
          icon={icon}
          tone={emphasize ? tone : 'default'}
          className="transition-shadow hover:shadow-md"
        />
      </Link>
    </motion.div>
  );
}
