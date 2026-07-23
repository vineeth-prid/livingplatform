import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import { qk, useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import type { Block, Floor, Phase } from '@living/types';
import {
  Badge, Button, EmptyState, LoadingState, PageContainer, PageHeader,
  PageTransition, StatCard,
} from '@living/ui';
import { Boxes, Building2, DoorOpen, FileText, Layers, Pencil, Plus, Sparkles } from 'lucide-react';

import { useCommunity } from './community-context';
import { BlockForm, FloorForm, PhaseForm } from './hierarchy-forms';
import { living } from '../../lib/living';
import { DetailSection, Field, FieldGrid, StatusBadge } from '../master-data';

const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/**
 * Community overview — the browse-centric master view of the active community:
 * details, hierarchy (blocks), amenities, settings summary, and documents.
 * Communities are provisioned by a Platform Admin (Administration → Communities);
 * associations build out the contents (blocks, units, amenities…) from here.
 */
export function CommunityOverviewPage() {
  const { community, communityId } = useCommunity();
  const { session, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isPlatform = (session?.roles ?? []).some((r) => r.scope === 'PLATFORM');
  const canManage = hasPermission('hierarchy:create');

  // Hierarchy editor drawers — one piece of state per node kind.
  const [blockForm, setBlockForm] = useState<{ block?: Block } | null>(null);
  const [floorForm, setFloorForm] = useState<{ floor?: Floor } | null>(null);
  const [phaseForm, setPhaseForm] = useState<{ phase?: Phase } | null>(null);

  const [detail, phases, blocks, floors, amenities, documents] = useQueries({
    queries: [
      { queryKey: qk.community(communityId ?? ''), queryFn: () => living.community.get(communityId!), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'phases'], queryFn: () => living.community.listPhases(communityId!, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'blocks'], queryFn: () => living.community.listBlocks(communityId!, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'floors'], queryFn: () => living.community.listFloors(communityId!, { limit: 200, sortBy: 'level', sortDir: 'asc' }), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'amenities'], queryFn: () => living.community.listAmenities(communityId!, { limit: 100 }), enabled: !!communityId },
      { queryKey: [...qk.community(communityId ?? ''), 'documents'], queryFn: () => living.community.listDocuments(communityId!, { limit: 50 }), enabled: !!communityId },
    ],
  });

  const blockName = new Map((blocks.data?.items ?? []).map((b) => [b.id, b.name]));

  if (!communityId) {
    return (
      <PageContainer>
        <EmptyState
          icon={Building2}
          title="No community yet"
          description={
            isPlatform
              ? 'Provision a community and its association admin from Administration.'
              : 'No community has been set up for you yet. Contact your platform administrator.'
          }
          action={
            isPlatform ? (
              <Button asChild>
                <Link to="/admin/communities">Go to Administration</Link>
              </Button>
            ) : undefined
          }
        />
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
                  title="Phases"
                  action={
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" size="sm">{phases.data?.meta.total ?? 0}</Badge>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => setPhaseForm({})}>
                          <Plus className="h-4 w-4" /> Add
                        </Button>
                      )}
                    </div>
                  }
                >
                  {phases.data && phases.data.items.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border-subtle">
                      {phases.data.items.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="flex items-center gap-3">
                            <Layers className="h-4 w-4 text-muted" />
                            <span className="text-sm font-medium text-strong">{p.name}</span>
                            <span className="font-mono text-xs text-subtle">{p.code}</span>
                          </span>
                          {canManage && (
                            <Button variant="ghost" size="sm" onClick={() => setPhaseForm({ phase: p })} aria-label={`Edit ${p.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-subtle">No phases. Phases are optional — group blocks by launch phase if useful.</p>
                  )}
                </DetailSection>

                <DetailSection
                  title="Blocks"
                  action={
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" size="sm">{blocks.data?.meta.total ?? 0}</Badge>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => setBlockForm({})}>
                          <Plus className="h-4 w-4" /> Add
                        </Button>
                      )}
                    </div>
                  }
                >
                  {blocks.data && blocks.data.items.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border-subtle">
                      {blocks.data.items.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => navigate({ to: '/units' as string, search: { blockId: b.id } })}
                            className="flex flex-1 items-center justify-between gap-3 text-left transition-colors hover:text-brand"
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
                          {canManage && (
                            <Button variant="ghost" size="sm" onClick={() => setBlockForm({ block: b })} aria-label={`Edit ${b.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      title="No blocks yet"
                      description={canManage ? 'Add the first block (tower/cluster) to start building the community.' : undefined}
                      action={canManage ? <Button size="sm" onClick={() => setBlockForm({})}><Plus className="h-4 w-4" /> Add block</Button> : undefined}
                    />
                  )}
                </DetailSection>

                <DetailSection
                  title="Floors"
                  action={
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" size="sm">{floors.data?.meta.total ?? 0}</Badge>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => setFloorForm({})} disabled={(blocks.data?.items.length ?? 0) === 0}>
                          <Plus className="h-4 w-4" /> Add
                        </Button>
                      )}
                    </div>
                  }
                >
                  {floors.data && floors.data.items.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border-subtle">
                      {floors.data.items.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="flex items-center gap-3">
                            <Layers className="h-4 w-4 text-muted" />
                            <span className="text-sm font-medium text-strong">{f.name ?? `Level ${f.level}`}</span>
                            <span className="text-xs text-subtle">{blockName.get(f.blockId) ?? '—'}</span>
                          </span>
                          {canManage && (
                            <Button variant="ghost" size="sm" onClick={() => setFloorForm({ floor: f })} aria-label={`Edit floor ${f.name ?? f.level}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-subtle">
                      {(blocks.data?.items.length ?? 0) === 0 ? 'Add a block first, then add its floors.' : 'No floors yet.'}
                    </p>
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

        {communityId && canManage && (
          <>
            {phaseForm && (
              <PhaseForm open onOpenChange={(o) => !o && setPhaseForm(null)} communityId={communityId} phase={phaseForm.phase} />
            )}
            {blockForm && (
              <BlockForm open onOpenChange={(o) => !o && setBlockForm(null)} communityId={communityId} block={blockForm.block} />
            )}
            {floorForm && (
              <FloorForm open onOpenChange={(o) => !o && setFloorForm(null)} communityId={communityId} floor={floorForm.floor} />
            )}
          </>
        )}
      </PageContainer>
    </PageTransition>
  );
}
