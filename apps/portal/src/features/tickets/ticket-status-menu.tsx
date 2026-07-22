import { ChevronDown } from 'lucide-react';
import { useAuth } from '@living/hooks';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@living/ui';
import type { TicketStatus } from '@living/types';

import { allowedStatusActions, isTerminal } from './status-workflow';

/**
 * Status transition menu — offers only valid, permitted next statuses (from the
 * client workflow mirror). Hidden entirely when nothing is possible.
 */
export function TicketStatusMenu({
  status, onChange, pending,
}: {
  status: TicketStatus;
  onChange: (to: TicketStatus) => void;
  pending?: boolean;
}) {
  const { session } = useAuth();
  const actions = allowedStatusActions(status, session?.permissions ?? []);
  if (actions.length === 0 || isTerminal(status)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" loading={pending}>
          Update status <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {actions.map((a) => (
          <DropdownMenuItem
            key={a.to}
            onSelect={() => onChange(a.to)}
            className={a.tone === 'danger' ? 'text-danger-fg focus:text-danger-fg' : undefined}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
