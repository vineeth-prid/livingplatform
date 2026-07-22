import { useNavigate } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { formatDate } from '@living/utils';
import {
  Badge, EmptyState, LoadingState, PageContainer, PageHeader,
  PageTransition, StatCard,
} from '@living/ui';
import { Boxes, Building2, DoorOpen, FileText, Layers, Sparkles } from 'lucide-react';

import { useCommunity } from './community-context';
import { living } from '../../lib/living';
import { DetailSection, Field, FieldGrid, StatusBadge } from '../master-data';

const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/**
 * Community overview — the browse-centric master view of the active community:
 * details, hierarchy (blocks), amenities, settings summary, and documents.
 */
export function CommunityOverviewPage() {
  const { community, communityId } = useCommunity();
  const navigate = useNavigate();

  const [detail, blocks, amenities, documents] = useQueries({
    queries: [
      { queryKey: qk.community(communityId ?? ''), queryFn: () => living.community.get(communityId!), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'blocks'], queryFn: () => living.community.listBlocks(communityId!, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'amenities'], queryFn: () => living.community.listAmenities(communityId!, { limit: 100 }), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'documents'], queryFn: () => living.community.listDocuments(communityId!, { limit: 50 }), enabled: !!communityId },
    ],
  });

  if (!communityId) {
    return (
      <PageContainer>
        <EmptyState icon={Building2} title="No community yet" description="Set up a community to see its overview here." />
      </PageContainer>
    );
  }

  const c = detail.data ?? community;
  const stats = c?.statistics;

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Master data"
          title={c?.name ?? 'Community'}
          description={c ? `${typeLabel(c.type)} · ${[c.city, c.state].filter(Boolean).join(', ')}` : undefined}
          actions={c ? <StatusBadge status={c.status} size="md" /> : undefined}
        />

        {detail.isLoading ? (
          <LoadingState />
        ) : c ? (
          <div className="flex flex-col gap-6">
            {stats && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard label="Phases" value={stats.phases} icon={Layers} />
                <StatCard label="Blocks" value={stats.blocks} icon={Building2} />
                <StatCard label="Units" value={stats.units} icon={DoorOpen} />
                <StatCard label="Amenities" value={stats.amenities} icon={Sparkles} />
                <StatCard label="Documents" value={stats.documents} icon={FileText} />
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col gap-6 lg:col-span-2">
                <DetailSection title="Details">
                  <FieldGrid>
                    <Field label="Code" value={<span className="font-mono">{c.code}</span>} />
                    <Field label="Type" value={typeLabel(c.type)} />
                    <Field label="Timezone" value={c.timezone} />
                    <Field label="Go-live" value={(c as { goLiveDate?: string }).goLiveDate ? formatDate((c as { goLiveDate?: string }).goLiveDate!) : null} />
                    <Field label="Contact email" value={c.contactEmail} />
                    <Field label="Contact phone" value={c.contactPhone} mono />
                  </FieldGrid>
                </DetailSection>

                <DetailSection
                  title="Blocks"
                  action={<Badge tone="neutral" size="sm">{blocks.data?.meta.total ?? 0}</Badge>}
                >
                  {blocks.data && blocks.data.items.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border-subtle">
                      {blocks.data.items.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => navigate({ to: '/units' as string, search: { blockId: b.id } })}
                            className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-brand"
                          >
                            <span className="flex items-center gap-3">
                              <Boxes className="h-4 w-4 text-muted" />
                              <span className="text-sm font-medium text-strong">{b.name}</span>
                              <span className="font-mono text-xs text-subtle">{b.code}</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <Badge tone="neutral" size="sm">{typeLabel(b.type.replace(/_/g, ' '))}</Badge>
                              {b.totalFloors != null && <span className="text-xs text-subtle">{b.totalFloors} floors</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No blocks yet" />
                  )}
                </DetailSection>

                <DetailSection title="Documents" action={<Badge tone="neutral" size="sm">{documents.data?.meta.total ?? 0}</Badge>}>
                  {documents.data && documents.data.items.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border-subtle">
                      {documents.data.items.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted" />
                            <span className="text-sm font-medium text-strong">{d.title}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge tone="neutral" size="sm">{d.category.replace(/_/g, ' ').toLowerCase()}</Badge>
                            <StatusBadge status={d.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-subtle">No documents yet. File uploads arrive in a later sprint.</p>
                  )}
                </DetailSection>
              </div>

              <div className="flex flex-col gap-6">
                <DetailSection title="Amenities" action={<Badge tone="neutral" size="sm">{amenities.data?.meta.total ?? 0}</Badge>}>
                  {amenities.data && amenities.data.items.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {amenities.data.items.map((a) => (
                        <Badge key={a.id} tone="brand" size="sm">{a.name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-subtle">No amenities configured.</p>
                  )}
                </DetailSection>

                <DetailSection title="Location">
                  <FieldGrid cols={2}>
                    <Field label="City" value={c.city} />
                    <Field label="State" value={c.state} />
                    <Field label="Country" value={c.country} />
                  </FieldGrid>
                </DetailSection>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="Community not found" />
        )}
      </PageContainer>
    </PageTransition>
  );
}
