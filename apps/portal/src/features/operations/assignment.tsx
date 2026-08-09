import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { qk } from '@living/hooks';
import {
  Avatar, Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@living/ui';
import type { Assignee } from '@living/types';

import { living } from '../../lib/living';

/** Staff (community) + vendors (tenant) for any assignment picker. */
export function useAssignees(communityId: string | null) {
  const staff = useQuery({
    queryKey: [...qk.staff(communityId ?? '', 'assignable')],
    queryFn: () => living.people.listStaff(communityId!, { limit: 100, status: 'ACTIVE' }),
    enabled: !!communityId,
  });
  const vendors = useQuery({
    queryKey: qk.vendors('assignable'),
    queryFn: () => living.people.listVendors({ limit: 100, status: 'ACTIVE' }),
  });
  return { staff, vendors };
}

/**
 * Generic assignment control shared by Service Requests and Work Orders.
 * Assign / reassign to a staff member or vendor (staff XOR vendor, per backend).
 */
export function OperationsAssignment({
  communityId, assignee, canAssign, pending, onAssign, only = 'both',
}: {
  communityId: string | null;
  assignee?: Assignee | null;
  canAssign: boolean;
  pending?: boolean;
  onAssign: (input: { staffId?: string; vendorId?: string }) => void;
  /**
   * Who may take this work.
   *
   * A SERVICE is bought from the vendor catalogue, so its picker lists vendors
   * only — offering staff there produced assignments the pricing and catalogue
   * model has no account of. A WORK ORDER genuinely can go either way, so it
   * keeps both.
   */
  only?: 'staff' | 'vendor' | 'both';
}) {
  const { staff, vendors } = useAssignees(communityId);
  const [open, setOpen] = useState(false);
  const name = assignee
    ? assignee.type === 'staff' ? `${assignee.firstName} ${assignee.lastName}` : assignee.name
    : null;

  return (
    <div className="flex items-center justify-between gap-3">
      {assignee ? (
        <div className="flex items-center gap-2.5">
          <Avatar name={name ?? ''} size="sm" />
          <div>
            <p className="text-sm font-medium text-strong">{name}</p>
            <Badge tone="neutral" size="sm">{assignee.type}</Badge>
          </div>
        </div>
      ) : (
        <p className="text-sm text-subtle">Unassigned</p>
      )}

      {canAssign && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" loading={pending}>
              <UserPlus className="h-4 w-4" /> {assignee ? 'Reassign' : 'Assign'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-64 overflow-y-auto">
            {only !== 'vendor' && (
              <>
                <DropdownMenuLabel>{only === 'staff' ? 'Assign to staff' : 'Staff'}</DropdownMenuLabel>
                {(staff.data?.items ?? []).map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => { onAssign({ staffId: s.id }); setOpen(false); }}>
                    <span className="truncate">{s.firstName} {s.lastName}</span>
                    <span className="ml-auto shrink-0 pl-2 text-xs text-subtle">
                      {s.role.toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </DropdownMenuItem>
                ))}
                {staff.data?.items.length === 0 && (
                  <p className="px-2.5 py-2 text-sm text-subtle">No staff yet — add one under People.</p>
                )}
              </>
            )}

            {only === 'both' && <DropdownMenuSeparator />}

            {only !== 'staff' && (
              <>
                <DropdownMenuLabel>{only === 'vendor' ? 'Assign to vendor' : 'Vendors'}</DropdownMenuLabel>
                {(vendors.data?.items ?? []).map((v) => (
                  <DropdownMenuItem key={v.id} onSelect={() => { onAssign({ vendorId: v.id }); setOpen(false); }}>
                    <span className="truncate">{v.companyName || v.name}</span>
                    <span className="ml-auto shrink-0 pl-2 text-xs text-subtle">{v.category.toLowerCase()}</span>
                  </DropdownMenuItem>
                ))}
                {vendors.data?.items.length === 0 && (
                  <p className="px-2.5 py-2 text-sm text-subtle">
                    No vendors covering this community yet.
                  </p>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
