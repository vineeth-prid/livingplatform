import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@living/utils';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';

export interface Workspace {
  id: string;
  name: string;
  subtitle?: string;
}

/**
 * Community / workspace switcher for the sidebar header. The active workspace
 * scopes most API calls (community-scoped endpoints), so this is a first-class
 * shell control.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSelect,
}: {
  workspaces: Workspace[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-control border border-border-subtle bg-card px-3 py-2 text-left transition-colors hover:bg-sunken focus-visible:shadow-ring focus-visible:outline-none">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand font-display text-sm text-brand-fg">
            {active?.name?.[0]?.toUpperCase() ?? 'L'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-strong">
              {active?.name ?? 'Select workspace'}
            </span>
            {active?.subtitle && (
              <span className="block truncate text-xs text-muted">{active.subtitle}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => onSelect(w.id)}>
            <span className="flex-1 truncate">{w.name}</span>
            <Check className={cn('h-4 w-4', w.id === active?.id ? 'opacity-100' : 'opacity-0')} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
