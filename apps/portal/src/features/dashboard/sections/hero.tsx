import { motion } from 'framer-motion';
import { formatDate } from '@living/utils';

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The dashboard hero: a warm greeting, the community, and today's date. */
export function Hero({ firstName, communityName }: { firstName?: string; communityName?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8"
    >
      <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">
        {communityName ?? 'Living'} · {formatDate(new Date())}
      </p>
      <h1 className="mt-1 font-display text-h1 leading-tight tracking-tight text-strong">
        {greeting()}{firstName ? `, ${firstName}` : ''}.
      </h1>
      <p className="mt-1.5 text-muted">Here’s what needs your attention today.</p>
    </motion.div>
  );
}
