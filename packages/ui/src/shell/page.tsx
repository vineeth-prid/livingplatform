import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@living/utils';

import { fadeRise, reduce } from '../motion';

/** Constrains page content to a comfortable reading width with page gutters. */
export function PageContainer({
  children,
  className,
  size = 'xl',
}: {
  children: ReactNode;
  className?: string;
  size?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
}) {
  const max =
    size === 'full'
      ? 'max-w-none'
      : { md: 'max-w-container-md', lg: 'max-w-container-lg', xl: 'max-w-container-xl', '2xl': 'max-w-container-2xl' }[size];
  return (
    <div className={cn('mx-auto w-full px-[var(--page-margin)] py-8', max, className)}>
      {children}
    </div>
  );
}

/** Page header: eyebrow / title / description + actions, with a calm entrance. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && (
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-subtle">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-h1 leading-tight tracking-tight text-strong">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Wrap route content to play a subtle enter transition on navigation. */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div variants={reduce(fadeRise, reduced)} initial="initial" animate="animate">
      {children}
    </motion.div>
  );
}
