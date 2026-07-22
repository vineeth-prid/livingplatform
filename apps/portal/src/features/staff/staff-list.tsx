import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { qk } from '@living/hooks';
import { Avatar, Badge } from '@living/ui';
import type { Staff } from '@living/types';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, StatusBadge, useListQuery, type ListColumn } from '../master-data';
import { opt, PERSON_STATUS, STAFF_ROLE } from '../master-data/options';
import { StaffForm } from './staff-form';

const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');

const columns: ListColumn<Staff>[] = [
  {
    key: 'name', header: 'Staff', sortKey: 'firstName',
    cell: (s) => (
      <div className="flex items-center gap-3">
        <Avatar name={`${s.firstName} ${s.lastName}`} src={s.photoUrl} size="sm" />
        <div>
          <p className="font-medium text-strong">{s.firstName} {s.lastName}</p>
          <p className="font-mono text-xs text-subtle">{s.employeeId}</p>
        </div>
      </div>
    ),
  },
  { key: 'role', header: 'Role', sortKey: 'role', cell: (s) => <Badge tone="brand" size="sm">{roleLabel(s.role)}</Badge> },
  { key: 'department', header: 'Department', cell: (s) => s.department ?? <span className="text-subtle">—</span> },
  { key: 'phone', header: 'Phone', cell: (s) => <span className="font-mono text-sm">{s.phone}</span> },
  { key: 'status', header: 'Status', sortKey: 'status', cell: (s) => <StatusBadge status={s.status} /> },
];

export function StaffListPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const query = useListQuery<Staff>({
    queryKey: qk.staff(communityId ?? '', 'list'),
    basePath: '/staff',
    filterKeys: ['role', 'status'],
    defaultSort: 'createdAt',
    enabled: !!communityId,
    fetch: (params) => living.people.listStaff(communityId!, params),
  });

  return (
    <>
      <ListScaffold
        title="Staff"
        description="The people who operate this community."
        query={query}
        columns={columns}
        rowKey={(s) => s.id}
        onRowClick={(s) => navigate({ to: `/staff/${s.id}` })}
        searchPlaceholder="Search name, employee ID, phone…"
        filters={[
          { key: 'role', placeholder: 'All roles', options: opt(STAFF_ROLE) },
          { key: 'status', placeholder: 'All statuses', options: opt(PERSON_STATUS) },
        ]}
        createPermission="staff:create"
        createLabel="Add staff"
        onCreate={() => setCreating(true)}
      />
      {communityId && (
        <StaffForm open={creating} onOpenChange={setCreating} communityId={communityId} onSaved={() => query.refetch()} />
      )}
    </>
  );
}
