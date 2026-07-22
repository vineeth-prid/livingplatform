import { type ReactNode } from 'react';
import { ChevronsUpDown, LogOut, User } from 'lucide-react';

import { Avatar } from '../components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';

/** Header profile dropdown. Menu actions delegated so it stays router-agnostic. */
export function ProfileMenu({
  name,
  email,
  avatarUrl,
  onSignOut,
  extraItems,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
  extraItems?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-pill p-0.5 pr-2 transition-colors hover:bg-sunken focus-visible:shadow-ring focus-visible:outline-none"
          aria-label="Account menu"
        >
          <Avatar name={name} src={avatarUrl} size="sm" />
          <ChevronsUpDown className="h-3.5 w-3.5 text-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[240px]">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium normal-case tracking-normal text-strong">{name}</span>
            <span className="truncate text-xs font-normal normal-case tracking-normal text-muted">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {extraItems ?? (
          <DropdownMenuItem>
            <User className="h-4 w-4" /> Profile
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="text-danger-fg focus:text-danger-fg">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
