import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { qk } from '@living/hooks';
import { Avatar, Badge } from '@living/ui';
import type { Vendor } from '@living/types';

import { living } from '../../lib/living';
import { ListScaffold, StatusBadge, useListQuery, type ListColumn } from '../master-data';
import { opt, PERSON_STATUS, VENDOR_CATEGORY } from '../master-data/options';
import { VendorForm } from './vendor-form';

const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');

const columns: ListColumn<Vendor>[] = [
  {
    key: 'name', header: 'Vendor', sortKey: 'name',
    cell: (v) => (
      <div className="flex items-center gap-3">
        <Avatar name={v.companyName || v.name} size="sm" />
        <div>
          <p className="font-medium text-strong">{v.companyName || v.name}</p>
          {v.companyName && <p className="text-xs text-subtle">{v.name}</p>}
        </div>
      </div>
    ),
  },
  { key: 'category', header: 'Category', sortKey: 'category', cell: (v) => <Badge tone="brand" size="sm">{catLabel(v.category)}</Badge> },
  { key: 'phone', header: 'Phone', cell: (v) => <span className="font-mono text-sm">{v.phone}</span> },
  { key: 'coverage', header: 'Coverage', cell: (v) => <span className="text-sm text-muted">{v.communityIds.length} communit{v.communityIds.length === 1 ? 'y' : 'ies'}</span> },
  { key: 'status', header: 'Status', sortKey: 'status', cell: (v) => <StatusBadge status={v.status} /> },
];

export function VendorsListPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const query = useListQuery<Vendor>({
    queryKey: qk.vendors('list'),
    basePath: '/vendors',
    filterKeys: ['category', 'status'],
    defaultSort: 'createdAt',
    fetch: (params) => living.people.listVendors(params),
  });

  return (
    <>
      <ListScaffold
        title="Vendors"
        description="External partners who service the community."
        query={query}
        columns={columns}
        rowKey={(v) => v.id}
        onRowClick={(v) => navigate({ to: `/vendors/${v.id}` })}
        searchPlaceholder="Search name, company, phone…"
        filters={[
          { key: 'category', placeholder: 'All categories', options: opt(VENDOR_CATEGORY) },
          { key: 'status', placeholder: 'All statuses', options: opt(PERSON_STATUS) },
        ]}
        createPermission="vendor:create"
        createLabel="Add vendor"
        onCreate={() => setCreating(true)}
      />
      <VendorForm open={creating} onOpenChange={setCreating} onSaved={() => query.refetch()} />
    </>
  );
}
