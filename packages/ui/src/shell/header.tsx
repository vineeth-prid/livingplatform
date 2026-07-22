import { type ReactNode } from 'react';
import { Bell, Menu, Search } from 'lucide-react';
import { cn } from '@living/utils';

import { Button } from '../components/button';

export interface Breadcrumb {
  label: string;
  href?: string;
}

/**
 * Top bar: mobile menu toggle, breadcrumbs, a command-palette search affordance,
 * notifications, and a slot for the profile menu / theme switch. Router-agnostic
 * (breadcrumb links delegated via `renderCrumb`).
 */
export function Header({
  breadcrumbs = [],
  onMenuClick,
  onSearchClick,
  right,
  renderCrumb,
  notificationCount,
  className,
}: {
  breadcrumbs?: Breadcrumb[];
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  right?: ReactNode;
  renderCrumb?: (crumb: Breadcrumb, content: ReactNode) => ReactNode;
  notificationCount?: number;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b border-border-subtle bg-raised/80 px-4 backdrop-blur-md',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 md:block">
        <ol className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, i) => {
            const last = i === breadcrumbs.length - 1;
            const content = (
              <span className={cn(last ? 'text-strong font-medium' : 'text-muted hover:text-body')}>
                {crumb.label}
              </span>
            );
            return (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border">/</span>}
                {crumb.href && renderCrumb && !last ? renderCrumb(crumb, content) : content}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <button
          onClick={onSearchClick}
          className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-page px-3 text-sm text-subtle transition-colors hover:text-body"
          aria-label="Search (Command-K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden rounded bg-sunken px-1.5 py-0.5 font-mono text-2xs text-muted lg:inline">
            ⌘K
          </kbd>
        </button>

        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-[var(--surface-raised)]" />
          ) : null}
        </Button>

        {right}
      </div>
    </header>
  );
}
