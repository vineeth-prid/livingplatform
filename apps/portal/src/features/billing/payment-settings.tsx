import { useState } from 'react';
import { CheckCircle2, CreditCard, Lock, ShieldAlert, Wrench } from 'lucide-react';
import type { PaymentConfigStatus, PaymentPurpose } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Badge, Button, Card, Input, LoadingState, PageContainer, PageHeader, toast } from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { CheckboxField, FormGrid, SelectField } from '../shared/form-kit';
import { usePaymentConfig, useSavePaymentConfig } from './queries';

const MODES = [
  { value: 'TEST', label: 'Test mode' },
  { value: 'LIVE', label: 'Live mode' },
];

const RAILS: Record<PaymentPurpose, { title: string; blurb: string; icon: typeof CreditCard }> = {
  MAINTENANCE: {
    title: 'Maintenance collection',
    blurb: 'Monthly, quarterly and yearly maintenance charges billed to residents.',
    icon: CreditCard,
  },
  SERVICE: {
    title: 'Service collection',
    blurb: 'Paid service requests and on-demand work residents book.',
    icon: Wrench,
  },
};

/**
 * Feature 2 — every community configures its OWN two Razorpay accounts.
 *
 * The page never receives a secret: it shows whether one is stored, and lets an
 * admin replace it. Leaving a secret field blank keeps whatever is already
 * saved, which is what makes "flip to live mode" a one-field edit.
 */
export function PaymentSettingsPage() {
  const { communityId, community } = useCommunity();
  const { hasPermission } = useAuth();
  const { data, isLoading } = usePaymentConfig(communityId);
  const canEdit = hasPermission('payment:config:update');

  if (isLoading || !data) return <LoadingState label="Loading payment settings…" />;

  return (
    <PageContainer>
      <PageHeader
        title="Payment settings"
        description={`Razorpay accounts for ${community?.name ?? 'this community'}. Each rail collects into its own account — they are never shared between communities.`}
      />

      <Card variant="elevated" className="mb-6 flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-sm text-muted">
          Key secrets and webhook secrets are encrypted before they are stored and are never sent
          back to this screen. Leave a secret blank to keep the one already saved.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.map((config) => (
          <RailCard
            key={config.purpose}
            config={config}
            communityId={communityId!}
            canEdit={canEdit}
          />
        ))}
      </div>
    </PageContainer>
  );
}

function RailCard({
  config,
  communityId,
  canEdit,
}: {
  config: PaymentConfigStatus;
  communityId: string;
  canEdit: boolean;
}) {
  const meta = RAILS[config.purpose];
  const Icon = meta.icon;
  const save = useSavePaymentConfig(communityId);

  const [mode, setMode] = useState(config.mode);
  const [accountName, setAccountName] = useState(config.accountName ?? '');
  const [merchantId, setMerchantId] = useState(config.merchantId ?? '');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(config.enabled);
  const [verifying, setVerifying] = useState(false);

  async function onSave() {
    try {
      await save.mutateAsync({
        purpose: config.purpose,
        input: {
          mode,
          accountName: accountName || undefined,
          merchantId: merchantId || undefined,
          // Only send fields the admin actually typed — an empty box means
          // "leave it alone", not "clear it".
          ...(keyId ? { keyId } : {}),
          ...(keySecret ? { keySecret } : {}),
          ...(webhookSecret ? { webhookSecret } : {}),
          enabled,
        },
      });
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      toast.success(`${meta.title} saved`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onVerify() {
    setVerifying(true);
    try {
      const result = await living.paymentConfig.verify(communityId, config.purpose);
      if (result.ok) toast.success('Razorpay accepted these credentials');
      else toast.error(result.reason ?? 'The gateway rejected these credentials');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card variant="elevated">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-tint text-brand">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-h4 tracking-tight text-strong">{meta.title}</h2>
            <p className="mt-0.5 text-sm text-muted">{meta.blurb}</p>
          </div>
        </div>
        {config.ready ? (
          <Badge tone="success" size="sm" dot>
            Ready
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            {config.keyIdMasked && config.hasKeySecret ? 'Not enabled' : 'Not configured'}
          </Badge>
        )}
      </div>

      {/* A bare "Not configured" sent admins back to re-enter credentials that
          were already stored correctly — the blocker is usually the enable
          switch, which is far down the card. Name the missing piece. */}
      {!config.ready && notReadyReason(config) && (
        <div className="mb-4 rounded-control bg-warning-bg px-3 py-2 text-sm text-warning-fg">
          {notReadyReason(config)}
        </div>
      )}

      {config.mode === 'LIVE' && config.ready && (
        <div className="mb-4 flex items-center gap-2 rounded-control bg-warning-bg px-3 py-2 text-sm text-warning-fg">
          <ShieldAlert className="h-4 w-4 shrink-0" /> Live mode — real money moves through this
          account.
        </div>
      )}

      <FormGrid>
        <SelectField label="Mode" value={mode} onChange={(v) => setMode(v as typeof mode)} options={MODES} disabled={!canEdit} />
        <Input
          label="Account label"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="e.g. Association maintenance"
          disabled={!canEdit}
        />
        <Input
          label="Merchant ID"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          placeholder="Razorpay merchant id"
          disabled={!canEdit}
        />
        <Input
          label="Key ID"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder={config.keyIdMasked ?? 'rzp_test_…'}
          hint={config.keyIdMasked ? `Saved: ${config.keyIdMasked}` : undefined}
          disabled={!canEdit}
        />
        <Input
          label="Key secret"
          type="password"
          autoComplete="new-password"
          value={keySecret}
          onChange={(e) => setKeySecret(e.target.value)}
          placeholder={config.hasKeySecret ? '•••••••• (saved)' : 'Enter the key secret'}
          hint={config.hasKeySecret ? 'Leave blank to keep the stored secret' : undefined}
          disabled={!canEdit}
        />
        <Input
          label="Webhook secret"
          type="password"
          autoComplete="new-password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={config.hasWebhookSecret ? '•••••••• (saved)' : 'Enter the webhook secret'}
          hint={config.hasWebhookSecret ? 'Leave blank to keep the stored secret' : undefined}
          disabled={!canEdit}
        />
      </FormGrid>

      <div className="mt-4">
        <CheckboxField
          label="Accept payments on this rail"
          checked={enabled}
          onChange={setEnabled}
          hint="Residents can only pay when this is on and a key id + secret are stored."
        />
      </div>

      <div className="mt-4 rounded-control bg-sunken px-3 py-2">
        <p className="text-xs font-medium text-strong">Webhook URL for Razorpay</p>
        {/* Derived from the configured API base URL, not the browser's origin.
            Rewriting the portal origin to :4000 only ever produced a correct URL
            on a developer's laptop — in production it hands the admin a webhook
            address Razorpay cannot reach, so payments are taken and never
            confirmed back. */}
        <code className="mt-1 block break-all text-xs text-muted">
          {`${apiBaseUrl()}/payments/webhooks/razorpay/${communityId}/${config.purpose}`}
        </code>
        <p className="mt-1 text-2xs text-subtle">
          Subscribe to <strong>payment.captured</strong>, <strong>order.paid</strong> and{' '}
          <strong>payment.failed</strong>.
        </p>
      </div>

      {canEdit && (
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onVerify}
            loading={verifying}
            disabled={!config.ready}
          >
            <CheckCircle2 className="h-4 w-4" /> Test connection
          </Button>
          <Button onClick={onSave} loading={save.isPending}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

/** The API's public base URL, without a trailing slash. */
function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (configured ?? `${window.location.origin}/api/v1`).replace(/\/+$/, '');
}

/**
 * Why a rail is not ready to take money.
 *
 * "Not configured" on its own sent an admin back to re-enter credentials that
 * were already saved correctly — the actual blocker is usually the enable
 * switch. Readiness is `enabled && keyId && keySecret` server-side; this names
 * whichever part is missing.
 */
function notReadyReason(config: {
  enabled: boolean;
  keyIdMasked: string | null;
  hasKeySecret: boolean;
}): string | null {
  if (!config.keyIdMasked) return 'Add the key id from your Razorpay dashboard.';
  if (!config.hasKeySecret) return 'Add the key secret — it is stored encrypted and never shown again.';
  if (!config.enabled) return 'Credentials are saved. Switch on “Accept payments on this rail” to go live.';
  return null;
}
