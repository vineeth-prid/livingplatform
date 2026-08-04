import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing, GripVertical, Image, Mail, MessageCircle, PhoneCall, Plus, Receipt, ShieldCheck,
  Sparkles, Trash2, Truck, Volume2,
} from 'lucide-react';
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

/** Matches the API's EmergencyContactDto and the resident app's reader. */
interface EmergencyContact {
  name: string;
  role?: string;
  phone: string;
}

interface SettingsDocument {
  maintenanceBillingEnabled: boolean;
  servicePackagesEnabled: boolean;
  homeBanners: HomeBanner[] | null;
  // Gate Management (Sprint 13). Optional so a settings document written before
  // this sprint still parses; the defaults below mirror the schema defaults.
  gateManagementEnabled?: boolean;
  gateApprovalEnabled?: boolean;
  gatePushEnabled?: boolean;
  gateWhatsappEnabled?: boolean;
  gateEmailEnabled?: boolean;
  gateSoundEnabled?: boolean;
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

      <GateSettings
        settings={settings.data}
        canEdit={canEdit}
        saving={save.isPending}
        onChange={(input) => save.mutate(input)}
      />

      <EmergencyContactsEditor />

      <BannerEditor
        banners={settings.data.homeBanners ?? []}
        canEdit={canEdit}
        saving={save.isPending}
        onSave={(homeBanners) => save.mutate({ homeBanners })}
      />
    </PageContainer>
  );
}

/**
 * Gate Management configuration.
 *
 * The channel switches NARROW what the Notification Engine already allows —
 * they never widen it. In-app is not listed because it is not optional: it is
 * the popup the resident approves from, and turning it off would leave the
 * approval step unreachable.
 */
function GateSettings({
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
  // Absent = a document written before this sprint; use the schema defaults.
  const on = (value: boolean | undefined, fallback: boolean) => value ?? fallback;
  const moduleOn = on(settings.gateManagementEnabled, true);

  async function toggleModule(next: boolean) {
    if (!next) {
      const ok = await confirm({
        title: 'Turn off Gate Management?',
        description:
          'Security can no longer record deliveries and residents stop receiving gate ' +
          'notifications. Existing entries and their history are kept.',
        confirmLabel: 'Turn off',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onChange({ gateManagementEnabled: next });
  }

  return (
    <Card variant="elevated" className="mb-6">
      <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Gate Management</h2>
      <p className="mb-4 text-sm text-muted">
        Deliveries recorded at the gate, and how residents hear about them.
      </p>

      <ModuleRow
        icon={Truck}
        title="Gate Management"
        description="Security records arrivals in the Workforce app; residents are notified instantly."
        enabled={moduleOn}
        disabled={!canEdit || saving}
        onChange={toggleModule}
      />
      <ModuleRow
        icon={ShieldCheck}
        title="Require resident approval"
        description="Deliveries wait for Approve or Reject. Off means residents are told, but security does not hold the delivery."
        enabled={on(settings.gateApprovalEnabled, true)}
        disabled={!canEdit || saving || !moduleOn}
        onChange={(next) => onChange({ gateApprovalEnabled: next })}
      />
      <ModuleRow
        icon={BellRing}
        title="Push notifications"
        description="Reaches residents when the app is closed. Requires push to be configured for the platform."
        enabled={on(settings.gatePushEnabled, true)}
        disabled={!canEdit || saving || !moduleOn}
        onChange={(next) => onChange({ gatePushEnabled: next })}
      />
      <ModuleRow
        icon={Volume2}
        title="Notification sound"
        description="Plays a chime and vibrates when the popup appears in the resident app."
        enabled={on(settings.gateSoundEnabled, true)}
        disabled={!canEdit || saving || !moduleOn}
        onChange={(next) => onChange({ gateSoundEnabled: next })}
      />
      <ModuleRow
        icon={MessageCircle}
        title="WhatsApp"
        description="Also send a WhatsApp message. Off by default — every message has a cost."
        enabled={on(settings.gateWhatsappEnabled, false)}
        disabled={!canEdit || saving || !moduleOn}
        onChange={(next) => onChange({ gateWhatsappEnabled: next })}
      />
      <ModuleRow
        icon={Mail}
        title="Email"
        description="Also send an email. Rarely useful for something happening right now."
        enabled={on(settings.gateEmailEnabled, false)}
        disabled={!canEdit || saving || !moduleOn}
        onChange={(next) => onChange({ gateEmailEnabled: next })}
      />
    </Card>
  );
}

/**
 * The numbers residents tap in an emergency. They live on the community record
 * (not the settings document) and had no editor anywhere — which is why the
 * resident app's Emergency contacts section was always empty.
 */
function EmergencyContactsEditor() {
  const { communityId, community } = useCommunity();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasPermission('community:update');

  const saved = (community?.emergencyContacts as EmergencyContact[] | undefined) ?? [];
  const [draft, setDraft] = useState<EmergencyContact[]>(saved);
  const [dirty, setDirty] = useState(false);

  // `saved` is a fresh array on every render, so key the re-sync off its value.
  const savedJson = JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) setDraft(JSON.parse(savedJson) as EmergencyContact[]);
  }, [savedJson, dirty]);

  const save = useMutation({
    mutationFn: (emergencyContacts: EmergencyContact[]) =>
      living.community.update(communityId!, { emergencyContacts }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community', communityId] });
      void qc.invalidateQueries({ queryKey: ['communities'] });
      setDirty(false);
      toast.success('Emergency contacts saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = (index: number, patch: Partial<EmergencyContact>) => {
    setDirty(true);
    setDraft((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const add = () => {
    setDirty(true);
    setDraft((rows) => [...rows, { name: '', role: '', phone: '' }]);
  };
  const remove = (index: number) => {
    setDirty(true);
    setDraft((rows) => rows.filter((_, i) => i !== index));
  };

  const valid = draft.every((c) => c.name.trim() && c.phone.trim());

  return (
    <Card variant="elevated" className="mb-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-h4 tracking-tight text-strong">Emergency contacts</h2>
          <p className="mt-0.5 text-sm text-muted">
            Security desk, plumber, ambulance — residents tap these to dial straight from the
            Community tab.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={add}>
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        )}
      </div>

      {draft.length === 0 ? (
        <p className="rounded-control bg-sunken px-4 py-6 text-center text-sm text-muted">
          No contacts yet. Residents see an empty Emergency contacts section until you add one.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {draft.map((contact, index) => (
            <div key={index} className="rounded-control border border-border-subtle p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-subtle">
                  <PhoneCall className="h-3.5 w-3.5" /> Contact {index + 1}
                </span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove contact ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FormGrid>
                <Input
                  label="Name"
                  value={contact.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder="Security desk"
                  disabled={!canEdit}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => update(index, { phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  disabled={!canEdit}
                  required
                />
                <FullWidth>
                  <Input
                    label="Role"
                    value={contact.role ?? ''}
                    onChange={(e) => update(index, { role: e.target.value })}
                    placeholder="Security"
                    hint="Shown under the name in the resident app"
                    disabled={!canEdit}
                  />
                </FullWidth>
              </FormGrid>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button
            loading={save.isPending}
            disabled={!valid || !dirty}
            onClick={() =>
              save.mutate(
                draft.map((c) => ({
                  name: c.name.trim(),
                  phone: c.phone.trim(),
                  ...(c.role?.trim() ? { role: c.role.trim() } : {}),
                })),
              )
            }
          >
            Save contacts
          </Button>
        </div>
      )}
    </Card>
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
