import { ChevronDown } from 'lucide-react';
import { useAuth } from '@living/hooks';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@living/ui';

import type { Workflow } from './workflow';

/** Generic status transition menu — offers only valid, permitted next statuses
 *  from the module's workflow. Hidden when nothing is possible. */
export function OperationsStatusMenu<S extends string>({
  status, workflow, onChange, pending, label = 'Update status',
}: {
  status: S;
  workflow: Workflow<S>;
  onChange: (to: S) => void;
  pending?: boolean;
  label?: string;
}) {
  const { session } = useAuth();
  const actions = workflow.allowedActions(status, session?.permissions ?? []);
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" loading={pending}>{label} <ChevronDown className="h-4 w-4" /></Button>
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
