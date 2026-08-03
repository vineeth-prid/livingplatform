import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Image, Plus, Receipt, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '@living/hooks';
import {
  Button, Card, Input, LoadingState, PageContainer, PageHeader, toast, useConfirm,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { FormGrid, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';

interface HomeBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageKey?: string;
  actionUrl?: string;
  kind?: 'announcement' | 'ad';
  sortOrder?: number;
}

interface SettingsDocument {
  maintenanceBillingEnabled: boolean;
  servicePackagesEnabled: boolean;
  homeBanners: HomeBanner[] | null;
}

/**
 * Community settings → modules and resident home banners.
 *
 * The two toggles here are load-bearing: turning maintenance billing off hides
 * every billing surface in the portal AND the resident app, and the API stops
 * accepting maintenance invoices and payments. The copy says so plainly rather
 * than presenting them as cosmetic switches.
 */
export function CommunitySettingsPage() {
  const { communityId, community } = useCommunity();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasPermission('settings:update');

  const settings = useQuery({
    queryKey: ['community', communityId, 'settings'],
    queryFn: () => living.community.getSettings<SettingsDocument>(communityId!),
    enabled: !!communityId,
  });

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      living.community.updateSettings(communityId!, input),
    onSuccess: () => {
      // The features query drives navigation visibility — refresh it too.
      void qc.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (settings.isLoading || !settings.data) return <LoadingState label="Loading settings…" />;

  return (
    <PageContainer>
      <PageHeader
        title="Community settings"
        description={`Modules and resident app content for ${community?.name ?? 'this community'}.`}
      />

      <ModuleToggles
        settings={settings.data}
        canEdit={canEdit}
        saving={save.isPending}
        onChange={(input) => save.mutate(input)}
      />

      <BannerEditor
        banners={settings.data.homeBanners ?? []}
        canEdit={canEdit}
        saving={save.isPending}
        onSave={(homeBanners) => save.mutate({ homeBanners })}
      />
    </PageContainer>
  );
}

function ModuleToggles({
  settings,
  canEdit,
  saving,
  onChange,
}: {
  settings: SettingsDocument;
  canEdit: boolean;
  saving: boolean;
  onChange: (input: Record<string, unknown>) => void;
}) {
  const confirm = useConfirm();

  async function toggleMaintenance(next: boolean) {
    if (!next) {
      const ok = await confirm({
        title: 'Turn off maintenance billing?',
        description:
          'Residents will no longer see maintenance dues or be able to pay, and invoice ' +
          'generation stops. Existing invoices and payment history are kept.',
        confirmLabel: 'Turn off',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onChange({ maintenanceBillingEnabled: next });
  }

  return (
    <Card variant="elevated" className="mb-6">
      <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Modules</h2>
      <p className="mb-4 text-sm text-muted">
        Not every association hands collection to Living. Switch a module off and it disappears
        from the portal and the resident app entirely.
      </p>

      <ModuleRow
        icon={Receipt}
        title="Maintenance billing"
        description="Rate cards, invoice generation, collection dashboards and resident payments."
        enabled={settings.maintenanceBillingEnabled}
        disabled={!canEdit || saving}
        onChange={toggleMaintenance}
      />
      <ModuleRow
        icon={Sparkles}
        title="Service packages"
        description="Bundles of services sold at a package price inside the resident app."
        enabled={settings.servicePackagesEnabled}
        disabled={!canEdit || saving}
        onChange={(next) => onChange({ servicePackagesEnabled: next })}
      />
    </Card>
  );
}

function ModuleRow({
  icon: Icon,
  title,
  description,
  enabled,
  disabled,
  onChange,
}: {
  icon: typeof Receipt;
  title: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-border-subtle py-4 first:border-0 first:pt-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-tint text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-strong">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:shadow-ring disabled:opacity-50 ${
          enabled ? 'bg-brand' : 'bg-sunken'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-raised shadow-sm transition-transform ${
            enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * The rotating hero on the resident home. Community announcements are merged in
 * live by the app; these are the community's own slides (offers, notices).
 */
function BannerEditor({
  banners,
  canEdit,
  saving,
  onSave,
}: {
  banners: HomeBanner[];
  canEdit: boolean;
  saving: boolean;
  onSave: (banners: HomeBanner[]) => void;
}) {
  const [draft, setDraft] = useState<HomeBanner[]>(banners);
  const [dirty, setDirty] = useState(false);

  // Re-sync when the server sends a newer document (e.g. after a save).
  useEffect(() => {
    if (!dirty) setDraft(banners);
  }, [banners, dirty]);

  const update = (index: number, patch: Partial<HomeBanner>) => {
    setDirty(true);
    setDraft((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const add = () => {
    setDirty(true);
    setDraft((rows) => [
      ...rows,
      { id: `banner-${Date.now()}`, title: '', kind: 'ad', sortOrder: rows.length },
    ]);
  };

  const remove = (index: number) => {
    setDirty(true);
    setDraft((rows) => rows.filter((_, i) => i !== index));
  };

  const valid = draft.every((b) => b.title.trim().length > 0);

  return (
    <Card variant="elevated">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-h4 tracking-tight text-strong">Home banners</h2>
          <p className="mt-0.5 text-sm text-muted">
            Rotating slides at the top of the resident home. Published announcements appear
            alongside these automatically — add slides here for offers and notices.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={add}>
            <Plus className="h-4 w-4" /> Add slide
          </Button>
        )}
      </div>

      {draft.length === 0 ? (
        <p className="rounded-control bg-sunken px-4 py-6 text-center text-sm text-muted">
          No slides. The resident home shows published announcements only.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {draft.map((banner, index) => (
            <div key={banner.id} className="rounded-control border border-border-subtle p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-subtle">
                  <GripVertical className="h-3.5 w-3.5" /> Slide {index + 1}
                </span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove slide ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FormGrid>
                <Input
                  label="Title"
                  value={banner.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  disabled={!canEdit}
                  required
                />
                <SelectField
                  label="Kind"
                  value={banner.kind ?? 'ad'}
                  onChange={(v) => update(index, { kind: v as HomeBanner['kind'] })}
                  options={[
                    { value: 'ad', label: 'Promotion' },
                    { value: 'announcement', label: 'Notice' },
                  ]}
                  disabled={!canEdit}
                />
                <FullWidth>
                  <TextAreaField
                    label="Subtitle"
                    value={banner.subtitle ?? ''}
                    onChange={(v) => update(index, { subtitle: v })}
                    rows={2}
                  />
                </FullWidth>
                <Input
                  label="Image key"
                  value={banner.imageKey ?? ''}
                  onChange={(e) => update(index, { imageKey: e.target.value })}
                  placeholder="storage key (optional)"
                  leading={<Image className="h-4 w-4" />}
                  disabled={!canEdit}
                />
                <Input
                  label="Opens"
                  value={banner.actionUrl ?? ''}
                  onChange={(e) => update(index, { actionUrl: e.target.value })}
                  placeholder="/services"
                  hint="In-app route the slide links to"
                  disabled={!canEdit}
                />
              </FormGrid>
            </div>
          ))}
        </div>
      )}

      {canEdit && draft.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            loading={saving}
            disabled={!valid || !dirty}
            onClick={() => {
              onSave(draft.map((b, i) => ({ ...b, sortOrder: i })));
              setDirty(false);
            }}
          >
            Save banners
          </Button>
        </div>
      )}
    </Card>
  );
}
