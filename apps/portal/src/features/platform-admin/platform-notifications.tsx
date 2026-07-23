import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LivingApiError, type EmailProviderName } from '@living/living-sdk';
import {
  Badge, Button, Card, Input, LoadingState, PageContainer, PageHeader, PageTransition, StatCard, toast,
} from '@living/ui';
import {
  AlertTriangle, CheckCircle2, Clock, Inbox, Mail, MessageCircle, RefreshCw, Send, ServerCrash, XCircle,
} from 'lucide-react';

import { living } from '../../lib/living';
import { KpiGrid, PlatformSection, StatusCard } from './components';
import { Tabs } from '../shared/tabs';
import {
  useEmailHealth, useEmailProvider, useNotificationChannels, useNotificationDeliveries,
  useNotificationStatistics, useWhatsAppHealth,
} from './hooks';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'history', label: 'History' },
];

/**
 * Notification Center — the Platform-Admin home for the Notification Engine.
 * One engine, many channels: cross-channel overview, per-channel controls
 * (Email provider switch/health/test; WhatsApp health/test) and delivery
 * history. Reads /notifications/* (channel-agnostic) + the preserved
 * /notifications/email/* routes.
 */
export function PlatformNotificationsPage() {
  const [tab, setTab] = useState('overview');
  const channels = useNotificationChannels();

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="Notification Center"
          description="One engine, many channels — email and WhatsApp today; push, SMS and more next."
        />

        {/* Channel health strip (always visible) */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(channels.data ?? []).map((c) => (
            <StatusCard
              key={c.channel}
              name={`${c.channel === 'email' ? 'Email' : 'WhatsApp'} · ${c.provider.toUpperCase()}`}
              ok={c.health?.state === 'healthy'}
              detail={c.health?.state === 'healthy' ? `Operational${c.health.latencyMs != null ? ` · ${c.health.latencyMs}ms` : ''}` : c.health?.reason}
            />
          ))}
        </div>

        <div className="mb-6"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'email' && <EmailTab />}
        {tab === 'whatsapp' && <WhatsAppTab />}
        {tab === 'history' && <HistoryTab />}
      </PageContainer>
    </PageTransition>
  );
}

function StatsBlock({ title, channel }: { title: string; channel?: string }) {
  const stats = useNotificationStatistics(channel);
  const s = stats.data;
  return (
    <PlatformSection title={title}>
      <KpiGrid cols={4}>
        <StatCard label="Sent" value={s?.sent ?? 0} icon={CheckCircle2} tone="success" />
        <StatCard label="Delivered" value={s?.delivered ?? 0} icon={CheckCircle2} />
        <StatCard label="Failed" value={s?.failed ?? 0} icon={XCircle} tone={(s?.failed ?? 0) > 0 ? 'danger' : 'default'} />
        <StatCard label="Dead-lettered" value={s?.deadLettered ?? 0} icon={AlertTriangle} tone={(s?.deadLettered ?? 0) > 0 ? 'warning' : 'default'} />
      </KpiGrid>
      <div className="mt-3">
        <KpiGrid cols={5}>
          <StatCard label="Queued" value={s?.queued ?? 0} icon={Inbox} />
          <StatCard label="Retrying" value={s?.retrying ?? 0} icon={RefreshCw} tone={(s?.retrying ?? 0) > 0 ? 'warning' : 'default'} />
          <StatCard label="Total retries" value={s?.totalRetries ?? 0} icon={RefreshCw} />
          <StatCard label="Avg delivery" value={`${s?.averageDeliveryMs ?? 0}ms`} icon={Clock} />
          <StatCard label="Queue waiting" value={s?.queue.waiting ?? 0} icon={Inbox} />
        </KpiGrid>
      </div>
    </PlatformSection>
  );
}

function OverviewTab() {
  const stats = useNotificationStatistics();
  return (
    <>
      <StatsBlock title="All channels — last 24 hours" />
      <PlatformSection title="By channel">
        <Card variant="elevated" padded={false} className="overflow-hidden">
          {(stats.data?.byChannel.length ?? 0) === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-subtle">No deliveries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
                {['Channel', 'Sent', 'Delivered', 'Failed'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {(stats.data?.byChannel ?? []).map((c) => (
                  <tr key={c.channel} className="border-t border-border-subtle">
                    <td className="px-4 py-2.5"><Badge tone="brand" size="sm">{c.channel.toUpperCase()}</Badge></td>
                    <td className="px-4 py-2.5 text-strong" data-numeric>{c.sent}</td>
                    <td className="px-4 py-2.5 text-muted" data-numeric>{c.delivered}</td>
                    <td className="px-4 py-2.5 text-muted" data-numeric>{c.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </PlatformSection>
    </>
  );
}

function EmailTab() {
  const qc = useQueryClient();
  const provider = useEmailProvider();
  const health = useEmailHealth();
  const switchProvider = useMutation({
    mutationFn: (name: EmailProviderName) => living.notifications.email.setProvider(name),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['platform'] }); toast.success('Provider switched'); },
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not switch provider'),
  });

  if (provider.isLoading) return <LoadingState />;
  return (
    <>
      <PlatformSection title="Email provider">
        <Card variant="elevated" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-tint text-brand"><Mail className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-semibold text-strong">Active provider</p>
                <p className="text-xs text-subtle">Configured: {provider.data?.configured?.toUpperCase()}{provider.data?.overridden ? ' · overridden' : ''}</p>
              </div>
            </div>
            <span className="flex items-center gap-2">
              <Badge tone="brand" size="md">{provider.data?.active?.toUpperCase()}</Badge>
              {health.data?.state === 'healthy'
                ? <CheckCircle2 className="h-5 w-5 text-success-fg" />
                : <ServerCrash className="h-5 w-5 text-danger-fg" />}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(provider.data?.supported ?? ['ses', 'smtp']).map((p) => (
              <Button key={p} variant={p === provider.data?.active ? 'primary' : 'secondary'} size="sm"
                loading={switchProvider.isPending && switchProvider.variables === p}
                disabled={p === provider.data?.active} onClick={() => switchProvider.mutate(p)}>
                <RefreshCw className="h-4 w-4" /> Use {p.toUpperCase()}
              </Button>
            ))}
          </div>
          <p className="text-xs text-subtle">Runtime switch is an ops failover; the boot default follows EMAIL_PROVIDER config.</p>
        </Card>
      </PlatformSection>
      <StatsBlock title="Email — last 24 hours" channel="email" />
      <PlatformSection title="Send a test email"><TestCard channel="email" placeholder="ops@living.local" /></PlatformSection>
    </>
  );
}

function WhatsAppTab() {
  const health = useWhatsAppHealth();
  return (
    <>
      <PlatformSection title="WhatsApp channel">
        <Card variant="elevated" className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-tint text-brand"><MessageCircle className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold text-strong">Meta Cloud API</p>
              {health.isLoading ? <p className="text-xs text-subtle">Checking…</p>
                : health.data?.state === 'healthy'
                  ? <p className="text-xs text-success-fg">Operational{health.data.latencyMs != null ? ` · ${health.data.latencyMs}ms` : ''}</p>
                  : <p className="text-xs text-danger-fg">{health.data?.reason ?? 'Unavailable'}</p>}
            </div>
          </div>
          {health.data?.state === 'healthy'
            ? <CheckCircle2 className="h-6 w-6 text-success-fg" />
            : <ServerCrash className="h-6 w-6 text-danger-fg" />}
        </Card>
      </PlatformSection>
      <StatsBlock title="WhatsApp — last 24 hours" channel="whatsapp" />
      <PlatformSection title="Send a test WhatsApp message"><TestCard channel="whatsapp" placeholder="+919876543210" /></PlatformSection>
    </>
  );
}

function TestCard({ channel, placeholder }: { channel: 'email' | 'whatsapp'; placeholder: string }) {
  const [to, setTo] = useState('');
  const send = useMutation({
    mutationFn: (address: string) => living.notifications[channel].test(address),
    onSuccess: (r) => toast.success(`Sent via ${r.provider.toUpperCase()}${r.messageId ? ` (${r.messageId})` : ''}`),
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not send test'),
  });
  return (
    <Card variant="elevated" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input label="Recipient" placeholder={placeholder} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button onClick={() => to && send.mutate(to)} loading={send.isPending} disabled={!to}>
        <Send className="h-4 w-4" /> Send test
      </Button>
    </Card>
  );
}

function HistoryTab() {
  const [channel, setChannel] = useState('');
  const [search, setSearch] = useState('');
  const deliveries = useNotificationDeliveries({ channel: channel || undefined, search: search || undefined });
  const tone = (s: string) => (['DELIVERED', 'READ', 'SENT'].includes(s) ? 'success' : ['FAILED', 'DEAD_LETTER'].includes(s) ? 'danger' : 'neutral');
  return (
    <PlatformSection title="Delivery history">
      <Card variant="elevated" padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle p-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, recipient, template…" className="max-w-xs" />
          <select value={channel} onChange={(e) => setChannel(e.target.value)}
            className="h-10 rounded-control border border-border bg-raised px-3 text-sm text-strong outline-none">
            <option value="">All channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        {deliveries.isLoading ? <LoadingState className="py-10" />
          : (deliveries.data?.items.length ?? 0) === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-subtle">No notifications recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
                  {['Time', 'Channel', 'Recipient', 'Subject', 'Provider', 'Status'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(deliveries.data?.items ?? []).map((d) => (
                    <tr key={d.id} className="border-t border-border-subtle">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5"><Badge tone="brand" size="sm">{d.channel.toUpperCase()}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{d.recipients[0] ?? '—'}</td>
                      <td className="px-4 py-2.5 text-strong">{d.subject || '—'}</td>
                      <td className="px-4 py-2.5 text-muted">{d.provider}</td>
                      <td className="px-4 py-2.5"><Badge tone={tone(d.status)} size="sm">{d.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </PlatformSection>
  );
}
