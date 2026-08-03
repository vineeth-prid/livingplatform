import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2Off, Plug, QrCode, RefreshCw, Send, ShieldCheck, Smartphone,
} from 'lucide-react';
import type { WhatsAppSession, WhatsAppSessionStatus } from '@living/living-sdk';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, PageContainer, PageHeader,
  StatCard, toast, useConfirm,
} from '@living/ui';

import { living } from '../../lib/living';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

/** NotificationDelivery lifecycle → badge tone. */
const DELIVERY_TONE: Record<string, Tone> = {
  QUEUED: 'neutral',
  PROCESSING: 'info',
  SENT: 'info',
  DELIVERED: 'success',
  READ: 'success',
  RETRYING: 'warning',
  FAILED: 'danger',
  DEAD_LETTER: 'danger',
};

const STATUS_TONE: Record<WhatsAppSessionStatus, Tone> = {
  CONNECTED: 'success',
  CONNECTING: 'info',
  QR_PENDING: 'warning',
  DISCONNECTED: 'neutral',
  FAILED: 'danger',
};

/**
 * Platform Admin → WhatsApp settings.
 *
 * Configuration and connection health only. The one send here is the explicit
 * diagnostic test — routine messaging is the Notification Engine's job, driven
 * by community preferences, and there is deliberately no compose box.
 */
export function PlatformWhatsAppPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin', 'whatsapp', 'settings'],
    queryFn: () => living.notifications.whatsapp.settings(),
  });
  const sessions = useQuery({
    queryKey: ['admin', 'whatsapp', 'sessions'],
    queryFn: () => living.notifications.whatsapp.sessions(),
    // Pairing state changes on the gateway's clock, not ours.
    refetchInterval: 10_000,
  });
  const stats = useQuery({
    queryKey: ['admin', 'whatsapp', 'stats'],
    queryFn: () => living.notifications.whatsapp.statistics(24),
  });
  const queue = useQuery({
    queryKey: ['admin', 'notifications', 'queue'],
    queryFn: () => living.notifications.queue(),
    refetchInterval: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'whatsapp'] });

  if (settings.isLoading || !settings.data) return <LoadingState label="Loading WhatsApp settings…" />;
  const s = settings.data;
  const isOpenWa = s.provider === 'openwa';

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform admin"
        title="WhatsApp"
        description="Gateway configuration, session health and delivery. Messages are sent by the Notification Engine — this page never composes one."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Provider" value={s.provider} icon={Plug} hint={`Supported: ${s.supported.join(', ')}`} />
        <StatCard label="Default sender" value={s.defaultSender || '—'} icon={Smartphone} />
        <StatCard label="Sent (24h)" value={stats.data?.sent ?? '—'} icon={Send} hint={`${stats.data?.failed ?? 0} failed`} />
        <StatCard
          label="Queue"
          value={queue.data ? queue.data.waiting + queue.data.active : '—'}
          icon={RefreshCw}
          hint={queue.data ? `${queue.data.retrying} retrying · ${queue.data.deadLettered} dead-lettered` : undefined}
          tone={queue.data && queue.data.failed > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card variant="elevated" className="mb-6">
        <h2 className="mb-3 font-display text-h4 tracking-tight text-strong">Gateway</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Base URL" value={isOpenWa ? s.openwa.baseUrl : 'Meta Cloud API'} mono />
          <Row label="Session" value={isOpenWa ? s.openwa.session : '—'} mono />
          <Row label="Auto-reconnect" value={isOpenWa ? (s.openwa.autoReconnect ? 'On' : 'Off') : '—'} />
          <Row label="Health poll" value={isOpenWa ? `every ${s.openwa.healthIntervalSec}s` : '—'} />
          <Row label="Rate limit" value={`${s.rateLimitPerMinute} messages / minute`} />
          <Row
            label="Webhook"
            value={
              s.openwa.webhookConfigured ? (
                <span className="inline-flex items-center gap-1.5 text-success-fg">
                  <ShieldCheck className="h-3.5 w-3.5" /> Signature verification on
                </span>
              ) : (
                <span className="text-warning-fg">No signing secret — callbacks are rejected</span>
              )
            }
          />
          {s.openwa.webhookUrl && <Row label="Callback URL" value={s.openwa.webhookUrl} mono />}
        </dl>
        <p className="mt-4 text-xs text-subtle">
          These come from environment configuration (WHATSAPP_PROVIDER, OPENWA_*). API keys and
          secrets are never returned by the API.
        </p>
      </Card>

      {!isOpenWa && (
        <Card variant="elevated" className="mb-6">
          <p className="text-sm text-muted">
            Sessions and QR pairing apply to the self-hosted OpenWA gateway. This deployment uses the
            Meta Cloud API, which authenticates with a business access token instead — set{' '}
            <code className="text-strong">WHATSAPP_PROVIDER=openwa</code> to switch.
          </p>
        </Card>
      )}

      <h2 className="mb-3 font-display text-h4 tracking-tight text-strong">Sessions</h2>
      {sessions.isLoading ? (
        <LoadingState label="Loading sessions…" />
      ) : (sessions.data ?? []).length === 0 ? (
        <EmptyState title="No sessions" description="A session row appears once the gateway is configured." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(sessions.data ?? []).map((session) => (
            <SessionCard key={session.id} session={session} enabled={isOpenWa} onChanged={invalidate} />
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TemplatesPanel />
        <TestSend />
      </div>

      <DeliveryLogPanel />
    </PageContainer>
  );
}

/**
 * The platform's built-in template catalogue. Read-only here on purpose:
 * platform defaults are files in the repo, and per-community *wording* is the
 * community admin's screen (Billing → Notifications), not the operator's.
 */
function TemplatesPanel() {
  const templates = useQuery({
    queryKey: ['admin', 'notifications', 'templates'],
    queryFn: () => living.notifications.templates(),
  });

  return (
    <Card variant="elevated">
      <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Templates</h2>
      <p className="mb-4 text-sm text-muted">
        Platform defaults available to every community, on every channel. Communities can override
        the wording per event from their own notification settings.
      </p>
      {templates.isLoading ? (
        <LoadingState label="Loading templates…" />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(templates.data ?? []).map((t) => (
            <span
              key={t.name}
              className="rounded-pill bg-sunken px-2.5 py-1 font-mono text-xs text-muted"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Recent WhatsApp deliveries — the operator's "did it actually send?" answer. */
function DeliveryLogPanel() {
  const deliveries = useQuery({
    queryKey: ['admin', 'whatsapp', 'deliveries'],
    queryFn: () => living.notifications.deliveries({ channel: 'whatsapp', limit: 25 }),
    refetchInterval: 30_000,
  });

  const rows = deliveries.data?.items ?? [];

  return (
    <Card variant="elevated" className="mt-6 p-0">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="font-display text-h4 tracking-tight text-strong">Logs</h2>
        <p className="mt-0.5 text-sm text-muted">
          The 25 most recent WhatsApp deliveries. Full history across every channel lives under
          Notifications.
        </p>
      </div>
      {deliveries.isLoading ? (
        <div className="p-4">
          <LoadingState label="Loading deliveries…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No WhatsApp deliveries yet"
            description="Messages appear here as the engine sends them."
          />
        </div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(d) => d.id}
          columns={[
            {
              key: 'to',
              header: 'Recipient',
              cell: (d) => (
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-body">
                    {d.recipients.join(', ') || '—'}
                  </p>
                  {d.template && <p className="truncate text-xs text-subtle">{d.template}</p>}
                </div>
              ),
            },
            {
              key: 'subject',
              header: 'Message',
              cell: (d) => <span className="text-sm text-body">{d.subject || '—'}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (d) => (
                <Badge tone={DELIVERY_TONE[d.status] ?? 'neutral'} size="sm" dot>
                  {d.status.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              ),
            },
            {
              key: 'retries',
              header: 'Retries',
              cell: (d) => (
                <span className={`text-sm ${d.retryCount > 0 ? 'text-warning-fg' : 'text-subtle'}`}>
                  {d.retryCount}
                </span>
              ),
            },
            {
              key: 'when',
              header: 'When',
              align: 'right',
              cell: (d) => (
                <span className="text-xs text-subtle">
                  {new Date(d.sentAt ?? d.createdAt).toLocaleString()}
                </span>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`mt-0.5 text-sm text-body ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function SessionCard({
  session,
  enabled,
  onChanged,
}: {
  session: WhatsAppSession;
  enabled: boolean;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const qr = useQuery({
    queryKey: ['admin', 'whatsapp', 'qr', session.name],
    queryFn: () => living.notifications.whatsapp.qr(session.name),
    // QR codes rotate every ~20s on the gateway; poll only while it is shown.
    enabled: showQr && session.status !== 'CONNECTED',
    refetchInterval: 8_000,
  });

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      onChanged();
      toast.success(`${label} requested`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card variant="elevated">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-strong">{session.name}</p>
          <p className="text-xs text-subtle">
            {session.phoneNumber ?? 'Not paired'} · {session.provider}
          </p>
        </div>
        <Badge tone={STATUS_TONE[session.status]} size="sm" dot>
          {session.status.replace('_', ' ').toLowerCase()}
        </Badge>
      </div>

      {session.lastError && (
        <p className="mb-3 rounded-control bg-danger-bg px-3 py-2 text-xs text-danger-fg">
          {session.lastError}
        </p>
      )}

      <dl className="mb-4 grid grid-cols-2 gap-3">
        <Row
          label="Last connected"
          value={session.lastConnectedAt ? new Date(session.lastConnectedAt).toLocaleString() : '—'}
        />
        <Row
          label="Last dropped"
          value={session.lastDisconnectedAt ? new Date(session.lastDisconnectedAt).toLocaleString() : '—'}
        />
      </dl>

      {showQr && session.status !== 'CONNECTED' && (
        <div className="mb-4 rounded-control bg-sunken p-4 text-center">
          {qr.data?.dataUrl ? (
            <img src={qr.data.dataUrl} alt="WhatsApp pairing QR code" className="mx-auto h-48 w-48" />
          ) : qr.data?.qr ? (
            <code className="block break-all text-2xs text-muted">{qr.data.qr}</code>
          ) : (
            <p className="text-sm text-muted">Waiting for the gateway to produce a QR code…</p>
          )}
          <p className="mt-2 text-xs text-subtle">
            WhatsApp → Linked devices → Link a device. The code refreshes automatically.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!enabled}
          loading={busy === 'Connect'}
          onClick={() => act('Connect', () => living.notifications.whatsapp.connect(session.name))}
        >
          <Plug className="h-4 w-4" /> Connect
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!enabled}
          loading={busy === 'Reconnect'}
          onClick={() => act('Reconnect', () => living.notifications.whatsapp.reconnect(session.name))}
        >
          <RefreshCw className="h-4 w-4" /> Reconnect
        </Button>
        <Button size="sm" variant="secondary" disabled={!enabled} onClick={() => setShowQr((v) => !v)}>
          <QrCode className="h-4 w-4" /> {showQr ? 'Hide QR' : 'Show QR'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!enabled}
          loading={busy === 'Disconnect'}
          onClick={async () => {
            if (
              !(await confirm({
                title: `Disconnect "${session.name}"?`,
                description: 'WhatsApp notifications stop until the session is paired again by QR.',
                confirmLabel: 'Disconnect',
                tone: 'danger',
              }))
            )
              return;
            await act('Disconnect', () => living.notifications.whatsapp.disconnect(session.name));
          }}
        >
          <Link2Off className="h-4 w-4" /> Disconnect
        </Button>
      </div>
    </Card>
  );
}

function TestSend() {
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);

  return (
    <Card variant="elevated" className="mt-6">
      <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Diagnostic send</h2>
      <p className="mb-4 text-sm text-muted">
        Sends one fixed test message to confirm the channel end to end. Rate-limited.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Input
            label="Recipient"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="+919876543210"
          />
        </div>
        <Button
          loading={sending}
          disabled={!to}
          onClick={async () => {
            setSending(true);
            try {
              const r = await living.notifications.whatsapp.test(to);
              toast.success(`Sent via ${r.provider}${r.messageId ? ` (${r.messageId})` : ''}`);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          <Send className="h-4 w-4" /> Send test
        </Button>
      </div>
    </Card>
  );
}
