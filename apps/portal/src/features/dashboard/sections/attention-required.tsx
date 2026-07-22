import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { listContainer, listItem } from '@living/ui/motion';
import { Badge, Card } from '@living/ui';

import { Section } from '../components/section';
import type { AttentionGroup } from '../derive';

const toneToBadge = { danger: 'danger', warning: 'warning', info: 'info' } as const;

/** Section 3 — priority cards that communicate urgency at a glance. When nothing
 *  needs attention, a calm "all clear" state (never an empty void). */
export function AttentionRequired({ groups, loading }: { groups: AttentionGroup[]; loading: boolean }) {
  const reduced = useReducedMotion();

  if (loading) {
    return (
      <Section title="Attention required">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-sunken motion-reduce:animate-none" />
          ))}
        </div>
      </Section>
    );
  }

  if (groups.length === 0) {
    return (
      <Section title="Attention required">
        <Card variant="quiet" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--success-bg)] text-success-fg">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-strong">All clear</p>
            <p className="text-sm text-muted">Nothing needs your attention right now.</p>
          </div>
        </Card>
      </Section>
    );
  }

  return (
    <Section title="Attention required">
      <motion.div
        variants={listContainer}
        initial="initial"
        animate="animate"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {groups.map((g) => (
          <motion.div key={g.id} variants={listItem} whileHover={reduced ? undefined : { y: -2 }}>
            <Link
              to={g.href}
              className="block rounded-card focus-visible:outline-none focus-visible:shadow-ring"
            >
              <Card variant="elevated" className="flex h-full items-start justify-between gap-3 transition-shadow hover:shadow-md">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-h3 leading-none tracking-tight text-strong" data-numeric>
                      {g.count}
                    </span>
                    <Badge tone={toneToBadge[g.tone]} dot size="sm">
                      {g.label}
                    </Badge>
                  </div>
                  {g.sample && <p className="mt-2 truncate text-sm text-muted">{g.sample}</p>}
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-subtle" />
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
