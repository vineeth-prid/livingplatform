import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { qk, Can } from '@living/hooks';
import { Avatar, Button } from '@living/ui';
import { Upload } from 'lucide-react';
import type { Resident } from '@living/types';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import {
  ListScaffold, StatusBadge, useListQuery, type ListColumn,
} from '../master-data';
import { opt, RESIDENT_STATUS } from '../master-data/options';
import { BulkUploadDrawer } from '../shared/bulk-upload';
import { ResidentForm } from './resident-form';

const columns: ListColumn<Resident>[] = [
  {
    key: 'name', header: 'Resident', sortKey: 'firstName',
    cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar name={`${r.firstName} ${r.lastName}`} src={r.photoUrl} size="sm" />
        <div>
          <p className="font-medium text-strong">{r.firstName} {r.lastName}</p>
          <p className="font-mono text-xs text-subtle">{r.residentCode}</p>
        </div>
      </div>
    ),
  },
  { key: 'mobile', header: 'Mobile', cell: (r) => <span className="font-mono text-sm">{r.mobile}</span> },
  {
    key: 'unit', header: 'Unit',
    cell: (r) => r.unitAssignment?.unit
      ? <span className="font-mono">{r.unitAssignment.unit.unitNumber}</span>
      : <span className="text-subtle">—</span>,
  },
  {
    key: 'occupancy', header: 'Occupancy',
    cell: (r) => {
      const role = r.unitAssignment?.role;
      return role === 'OWNER' || role === 'TENANT'
        ? <span className="text-sm">{role === 'OWNER' ? 'Owner' : 'Tenant'}</span>
        : <span className="text-subtle">—</span>;
    },
  },
  { key: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusBadge status={r.status} /> },
];

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'OWNER', label: 'Owners' },
  { key: 'TENANT', label: 'Tenants' },
];

export function ResidentsListPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const query = useListQuery<Resident>({
    queryKey: qk.residents(communityId ?? '', 'list'),
    basePath: '/residents',
    filterKeys: ['status', 'role'],
    defaultSort: 'createdAt',
    enabled: !!communityId,
    fetch: (params) => living.people.listResidents(communityId!, params),
  });

  const activeTab = query.filters.role ?? 'all';

  return (
    <>
      <ListScaffold
        title="Residents"
        description="Everyone living across the community."
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: `/residents/${r.id}` })}
        searchPlaceholder="Search name, mobile, email, code…"
        filters={[{ key: 'status', placeholder: 'All statuses', options: opt(RESIDENT_STATUS) }]}
        tabs={{ items: TABS, active: activeTab, onChange: (k) => query.setFilter('role', k === 'all' ? '' : k) }}
        createPermission="resident:create"
        createLabel="Add resident"
        onCreate={() => setCreating(true)}
        headerActions={
          <Can perm="resident:create">
            <Button variant="secondary" onClick={() => setUploading(true)}>
              <Upload className="h-4 w-4" /> Bulk upload
            </Button>
          </Can>
        }
      />
      {communityId && (
        <>
          <ResidentForm
            open={creating}
            onOpenChange={setCreating}
            communityId={communityId}
            onSaved={() => query.refetch()}
          />
          <BulkUploadDrawer
            open={uploading}
            onOpenChange={setUploading}
            kind="residents"
            communityId={communityId}
            onDone={() => query.refetch()}
          />
        </>
      )}
    </>
  );
}
