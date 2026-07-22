import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import {
  Avatar, Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, toast,
} from '@living/ui';
import type { Assignee } from '@living/types';

import { useAssignees, useTicketMutations } from './queries';

/**
 * Assignment control: shows the current assignee, and (with ticket:assign) a
 * picker of community staff or covering vendors. Assign/reassign only — the
 * backend has no unassign for tickets.
 */
export function TicketAssignment({
  ticketId, communityId, assignee,
}: {
  ticketId: string;
  communityId: string | null;
  assignee?: Assignee | null;
}) {
  const { hasPermission } = useAuth();
  const { assign } = useTicketMutations(ticketId);
  const { staff, vendors } = useAssignees(communityId);
  const [open, setOpen] = useState(false);
  const canAssign = hasPermission('ticket:assign');

  async function pick(input: { staffId?: string; vendorId?: string }) {
    try {
      await assign.mutateAsync(input);
      toast.success('Ticket assigned');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not assign');
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {assignee ? (
        <div className="flex items-center gap-2.5">
          <Avatar name={assignee.type === 'staff' ? `${assignee.firstName} ${assignee.lastName}` : assignee.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-strong">
              {assignee.type === 'staff' ? `${assignee.firstName} ${assignee.lastName}` : assignee.name}
            </p>
            <Badge tone="neutral" size="sm">{assignee.type}</Badge>
          </div>
        </div>
      ) : (
        <p className="text-sm text-subtle">Unassigned</p>
      )}

      {canAssign && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" loading={assign.isPending}>
              <UserPlus className="h-4 w-4" /> {assignee ? 'Reassign' : 'Assign'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Staff</DropdownMenuLabel>
            {(staff.data?.items ?? []).map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => void pick({ staffId: s.id })}>
                {s.firstName} {s.lastName}
                <span className="ml-auto text-xs text-subtle">{s.role.toLowerCase().replace(/_/g, ' ')}</span>
              </DropdownMenuItem>
            ))}
            {staff.data?.items.length === 0 && <p className="px-2.5 py-2 text-sm text-subtle">No staff</p>}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Vendors</DropdownMenuLabel>
            {(vendors.data?.items ?? []).map((v) => (
              <DropdownMenuItem key={v.id} onSelect={() => void pick({ vendorId: v.id })}>
                {v.companyName || v.name}
                <span className="ml-auto text-xs text-subtle">{v.category.toLowerCase()}</span>
              </DropdownMenuItem>
            ))}
            {vendors.data?.items.length === 0 && <p className="px-2.5 py-2 text-sm text-subtle">No vendors</p>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
