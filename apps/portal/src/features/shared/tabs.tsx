import { type ComponentType } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@living/utils';

export interface TabDef {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
}

/** A lightweight tab strip with an animated active underline — a token-styled
 *  composition (no new UI system). Content is rendered by the parent per key. */
export function Tabs({ tabs, active, onChange, layoutId = 'tab-underline' }: {
  tabs: TabDef[]; active: string; onChange: (k: string) => void; layoutId?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border-subtle">
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button key={t.key} role="tab" aria-selected={selected} onClick={() => onChange(t.key)}
            className={cn('relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none',
              selected ? 'text-strong' : 'text-subtle hover:text-body')}>
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
            {t.count != null && t.count > 0 && <span className="ml-0.5 rounded-full bg-sunken px-1.5 text-2xs text-muted">{t.count}</span>}
            {selected && (
              <motion.span layoutId={layoutId} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand"
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
