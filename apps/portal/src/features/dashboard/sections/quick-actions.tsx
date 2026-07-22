import { type ComponentType } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, LifeBuoy, Search, Users, Wrench } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { Card, useCommandPalette } from '@living/ui';
import type { Permission } from '@living/types';

import { Section } from '../components/section';

interface Action {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  perm?: Permission;
  /** Navigation target; when omitted the action opens the command palette. */
  to?: string;
}

const ACTIONS: Action[] = [
  { id: 'ticket', label: 'Raise ticket', icon: LifeBuoy, perm: 'ticket:create', to: '/tickets' },
  { id: 'work-order', label: 'Create work order', icon: Building2, perm: 'workorder:create', to: '/work-orders' },
  { id: 'service', label: 'New service request', icon: Wrench, perm: 'service:create', to: '/service-requests' },
  { id: 'residents', label: 'Search residents', icon: Users, perm: 'resident:read', to: '/residents' },
  { id: 'units', label: 'Search units', icon: Search },
];

/**
 * Large, keyboard-accessible action cards. Search opens the ⌘K palette; the rest
 * navigate. Permission-gated so users only see what they can do.
 */
export function QuickActions() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { open: openSearch } = useCommandPalette();
  const reduced = useReducedMotion();

  const visible = ACTIONS.filter((a) => !a.perm || hasPermission(a.perm));
  if (visible.length === 0) return null;

  return (
    <Section title="Quick actions">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((a) => (
          <motion.button
            key={a.id}
            type="button"
            onClick={() => (a.to ? navigate({ to: a.to }) : openSearch())}
            whileHover={reduced ? undefined : { y: -3 }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-card text-left focus-visible:outline-none focus-visible:shadow-ring"
          >
            <Card variant="elevated" className="flex h-full flex-col gap-3 transition-shadow hover:shadow-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-tint text-brand">
                <a.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-strong">{a.label}</span>
            </Card>
          </motion.button>
        ))}
      </div>
    </Section>
  );
}
