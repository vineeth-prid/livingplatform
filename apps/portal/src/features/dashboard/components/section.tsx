import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { listItem } from '@living/ui/motion';

/**
 * A dashboard section with a quiet eyebrow heading. Wrapped as a motion item so
 * the page can stagger sections on reveal (via a `listContainer` parent).
 */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.section variants={listItem} className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-subtle">{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}
