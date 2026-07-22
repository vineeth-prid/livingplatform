import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@living/utils';

import { Badge } from '../components/badge';

export interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Dashboard sidebar. Rendering of links is delegated via `renderLink` so the
 * shell stays router-agnostic (TanStack Router in portal, anything elsewhere).
 * `activeHref` drives the selected state.
 */
export function Sidebar({
  sections,
  activeHref,
  header,
  footer,
  renderLink,
  className,
}: {
  sections: NavSection[];
  activeHref?: string;
  header?: ReactNode;
  footer?: ReactNode;
  renderLink: (item: NavItem, content: ReactNode, active: boolean) => ReactNode;
  className?: string;
}) {
  return (
    <nav
      className={cn('flex h-full w-64 flex-col border-r border-border-subtle bg-raised', className)}
      aria-label="Primary"
    >
      {header && <div className="px-4 py-5">{header}</div>}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {sections.map((section, i) => (
          <div key={i} className="mb-4">
            {section.title && (
              <p className="px-3 pb-1.5 pt-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = activeHref === item.href;
                const content = (
                  <span
                    className={cn(
                      'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-tint text-[var(--text-on-tint)]'
                        : 'text-body hover:bg-sunken hover:text-strong',
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <Badge tone={active ? 'brand' : 'neutral'} size="sm" data-numeric>
                        {item.badge}
                      </Badge>
                    ) : null}
                  </span>
                );
                return <li key={item.href}>{renderLink(item, content, active)}</li>;
              })}
            </ul>
          </div>
        ))}
      </div>
      {footer && <div className="border-t border-border-subtle p-3">{footer}</div>}
    </nav>
  );
}
