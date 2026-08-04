import { useNavigate } from '@tanstack/react-router';
import type { GateEntry } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Badge } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { DELIVERY_TYPES, GATE_STATUS, GateStatusBadge, humanize } from './gate-lib';

/**
 * Delivery history — the searchable register of everything that arrived at a
 * gate. Read-only by design: the lifecycle belongs to the guard at the gate and
 * the resident on their phone, not to someone scrolling a table.
 */
export function GateDeliveriesPage() {
  const { communityId } = useCommunity();
  const navigate = useNavigate();

  const list = useListQuery<GateEntry>({
    queryKey: ['gate-entries', communityId ?? ''],
    basePath: '/gate',
    filterKeys: ['status', 'deliveryType', 'vendorName'],
    defaultSort: 'createdAt',
    enabled: !!communityId,
    fetch: (params) => living.gate.list(communityId!, params),
  });

  const columns: ListColumn<GateEntry>[] = [
    {
      key: 'entry',
      header: 'Delivery',
      sortKey: 'personName',
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">
            {e.vendorName ?? 'Delivery'} · {e.personName}
          </p>
          <p className="truncate text-xs text-subtle">
            {e.entryNumber}
            {e.mobileNumber ? ` · ${e.mobileNumber}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Apartment',
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-body" data-numeric>
            {e.unit?.unitNumber ?? '—'}
          </p>
          {e.resident && (
            <p className="truncate text-xs text-subtle">
              {e.resident.firstName} {e.resident.lastName}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (e) =>
        e.deliveryType ? (
          <Badge tone="neutral" size="sm">
            {humanize(e.deliveryType)}
          </Badge>
        ) : null,
    },
    {
      key: 'gate',
      header: 'Gate',
      cell: (e) => <span className="text-sm text-muted">{e.gate?.name ?? '—'}</span>,
    },
    {
      key: 'arrived',
      header: 'Arrived',
      sortKey: 'createdAt',
      cell: (e) => <span className="text-sm text-muted">{formatDateTime(e.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (e) => (
        <div className="flex items-center gap-1.5">
          <GateStatusBadge status={e.status} />
          {e.notificationFailed && (
            <Badge tone="warning" size="sm">
              Not reached
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <ListScaffold
      title="Deliveries"
      description="Everything recorded at the gate, with the resident's decision and full audit trail."
      query={list}
      columns={columns}
      rowKey={(e) => e.id}
      onRowClick={(e) => navigate({ to: `/gate/${e.id}` })}
      searchPlaceholder="Search person, vendor, phone, apartment, reference…"
      filters={[
        { key: 'status', placeholder: 'All statuses', options: opt(GATE_STATUS) },
        { key: 'deliveryType', placeholder: 'All types', options: opt(DELIVERY_TYPES) },
      ]}
    />
  );
}
