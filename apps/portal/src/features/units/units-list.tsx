import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { qk, Can } from '@living/hooks';
import { Button } from '@living/ui';
import { Upload } from 'lucide-react';
import type { Unit } from '@living/types';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, StatusBadge, useListQuery, type ListColumn } from '../master-data';
import { opt, OWNERSHIP, UNIT_STATUS } from '../master-data/options';
import { BulkUploadDrawer } from '../shared/bulk-upload';
import { UnitForm } from './unit-form';

const ownershipLabel = (o: string) => o.charAt(0) + o.slice(1).toLowerCase().replace(/_/g, ' ');

export function UnitsListPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Resolve block ids → names once, so the list can show block without N+1 fetches.
  const { data: blocks } = useQuery({
    queryKey: [...qk.community(communityId ?? ''), 'blocks', 'map'],
    queryFn: () => living.community.listBlocks(communityId!, { limit: 100 }),
    enabled: !!communityId,
  });
  const blockName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of blocks?.items ?? []) m.set(b.id, b.name);
    return m;
  }, [blocks]);

  const columns: ListColumn<Unit>[] = [
    { key: 'unitNumber', header: 'Unit', sortKey: 'unitNumber', cell: (u) => <span className="font-mono font-medium text-strong">{u.unitNumber}</span> },
    { key: 'block', header: 'Block', cell: (u) => u.blockId ? (blockName.get(u.blockId) ?? '—') : <span className="text-subtle">—</span> },
    { key: 'type', header: 'Type', sortKey: 'type', cell: (u) => u.type ?? <span className="text-subtle">—</span> },
    { key: 'beds', header: 'Beds', align: 'center', cell: (u) => u.bedrooms ?? '—' },
    { key: 'ownership', header: 'Ownership', cell: (u) => <span className="text-sm text-muted">{ownershipLabel(u.ownership)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (u) => <StatusBadge status={u.status} /> },
  ];

  const query = useListQuery<Unit>({
    queryKey: qk.units(communityId ?? '', 'list'),
    basePath: '/units',
    filterKeys: ['status', 'ownership', 'blockId'],
    defaultSort: 'unitNumber',
    enabled: !!communityId,
    fetch: (params) => living.community.listUnits(communityId!, params),
  });

  return (
    <>
      <ListScaffold
        title="Units"
        description="Every home and space across the community."
        query={query}
        columns={columns}
        rowKey={(u) => u.id}
        onRowClick={(u) => navigate({ to: `/units/${u.id}` })}
        searchPlaceholder="Search unit number…"
        filters={[
          { key: 'status', placeholder: 'All statuses', options: opt(UNIT_STATUS) },
          { key: 'ownership', placeholder: 'All ownership', options: opt(OWNERSHIP) },
          ...(blocks?.items.length
            ? [{ key: 'blockId', placeholder: 'All blocks', options: blocks.items.map((b) => ({ value: b.id, label: b.name })) }]
            : []),
        ]}
        createPermission="unit:create"
        createLabel="Add unit"
        onCreate={() => setCreating(true)}
        headerActions={
          <Can perm="unit:create">
            <Button variant="secondary" onClick={() => setUploading(true)}>
              <Upload className="h-4 w-4" /> Bulk upload
            </Button>
          </Can>
        }
      />
      {communityId && (
        <>
          <UnitForm open={creating} onOpenChange={setCreating} communityId={communityId} onSaved={() => query.refetch()} />
          <BulkUploadDrawer open={uploading} onOpenChange={setUploading} kind="units" communityId={communityId} onDone={() => query.refetch()} />
        </>
      )}
    </>
  );
}
