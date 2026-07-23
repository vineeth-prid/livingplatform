import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LivingApiError, type EmailProviderName } from '@living/living-sdk';
import {
  Badge, Button, Card, Input, LoadingState, PageContainer, PageHeader, PageTransition, StatCard, toast,
} from '@living/ui';
import { AlertTriangle, CheckCircle2, Clock, Inbox, Mail, RefreshCw, Send, ServerCrash, XCircle } from 'lucide-react';

import { living } from '../../lib/living';
import { KpiGrid, PlatformSection } from './components';
import { useEmailHealth, useEmailProvider, useEmailStatistics } from './hooks';

/**
 * Platform-Admin controls for the Notification Engine's Email Service: the
 * active provider (+ runtime switch), live provider health, delivery statistics
 * and a "send test email" action. Reads the /notifications/email/* endpoints.
 */
export function PlatformNotificationsPage() {
  const qc = useQueryClient();
  const provider = useEmailProvider();
  const health = useEmailHealth();
  const stats = useEmailStatistics();

  const switchProvider = useMutation({
    mutationFn: (name: EmailProviderName) => living.notifications.email.setProvider(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform', 'email'] });
      toast.success('Provider switched');
    },
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not switch provider'),
  });

  const s = stats.data;

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="Notifications · Email"
          description="Provider, health and delivery for the Notification Engine’s Email Service."
        />

        {provider.isLoading ? (
          <LoadingState />
        ) : (
          <>
            {/* Provider + health */}
            <PlatformSection title="Provider & health">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card variant="elevated" className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-tint text-brand"><Mail className="h-4 w-4" /></span>
                      <div>
                        <p className="text-sm font-semibold text-strong">Active provider</p>
                        <p className="text-xs text-subtle">Configured: {provider.data?.configured?.toUpperCase()}{provider.data?.overridden ? ' · overridden at runtime' : ''}</p>
                      </div>
                    </div>
                    <Badge tone="brand" size="md">{provider.data?.active?.toUpperCase()}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(provider.data?.supported ?? ['ses', 'smtp']).map((p) => (
                      <Button key={p} variant={p === provider.data?.active ? 'primary' : 'secondary'} size="sm"
                        loading={switchProvider.isPending && switchProvider.variables === p}
                        disabled={p === provider.data?.active}
                        onClick={() => switchProvider.mutate(p)}>
                        <RefreshCw className="h-4 w-4" /> Use {p.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-subtle">Runtime switch is an ops failover; the boot default always follows the EMAIL_PROVIDER config.</p>
                </Card>

                <Card variant="elevated" className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-strong">Provider health</p>
                    {health.isLoading ? (
                      <p className="text-xs text-subtle">Checking…</p>
                    ) : health.data?.state === 'healthy' ? (
                      <p className="text-xs text-success-fg">Operational{health.data.latencyMs != null ? ` · ${health.data.latencyMs}ms` : ''}</p>
                    ) : (
                      <p className="text-xs text-danger-fg">{health.data?.reason ?? 'Unavailable'}</p>
                    )}
                  </div>
                  {health.data?.state === 'healthy'
                    ? <CheckCircle2 className="h-6 w-6 shrink-0 text-success-fg" />
                    : <ServerCrash className="h-6 w-6 shrink-0 text-danger-fg" />}
                </Card>
              </div>
            </PlatformSection>

            {/* Delivery statistics (24h) */}
            <PlatformSection title="Delivery — last 24 hours">
              <KpiGrid>
                <StatCard label="Sent" value={s?.sent ?? 0} icon={CheckCircle2} tone="success" />
                <StatCard label="Failed" value={s?.failed ?? 0} icon={XCircle} tone={(s?.failed ?? 0) > 0 ? 'danger' : 'default'} />
                <StatCard label="Dead-lettered" value={s?.deadLettered ?? 0} icon={AlertTriangle} tone={(s?.deadLettered ?? 0) > 0 ? 'warning' : 'default'} />
                <StatCard label="Avg delivery" value={`${s?.averageDeliveryMs ?? 0}ms`} icon={Clock} />
              </KpiGrid>
              <div className="mt-3">
                <KpiGrid cols={5}>
                  <StatCard label="Queued" value={s?.queued ?? 0} icon={Inbox} />
                  <StatCard label="Processing" value={s?.processing ?? 0} icon={RefreshCw} />
                  <StatCard label="Retrying" value={s?.retrying ?? 0} icon={RefreshCw} tone={(s?.retrying ?? 0) > 0 ? 'warning' : 'default'} />
                  <StatCard label="Total retries" value={s?.totalRetries ?? 0} icon={RefreshCw} />
                  <StatCard label="Queue waiting" value={s?.queue.waiting ?? 0} icon={Inbox} />
                </KpiGrid>
              </div>
            </PlatformSection>

            {/* By provider + DLQ */}
            <PlatformSection title="Queue & providers">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card variant="elevated" padded={false} className="overflow-hidden">
                  <div className="border-b border-border-subtle px-4 py-2.5 text-sm font-semibold text-strong">Live queue (BullMQ)</div>
                  <div className="grid grid-cols-2 gap-px bg-border-subtle sm:grid-cols-5">
                    {([['Waiting', s?.queue.waiting], ['Active', s?.queue.active], ['Delayed', s?.queue.delayed], ['Failed', s?.queue.failed], ['Completed', s?.queue.completed]] as const).map(([k, v]) => (
                      <div key={k} className="bg-raised px-4 py-3">
                        <p className="text-2xs uppercase tracking-wider text-subtle">{k}</p>
                        <p className="font-display text-h4 text-strong" data-numeric>{v ?? 0}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card variant="elevated" padded={false} className="overflow-hidden">
                  <div className="border-b border-border-subtle px-4 py-2.5 text-sm font-semibold text-strong">By provider</div>
                  {(s?.byProvider.length ?? 0) === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-subtle">No deliveries yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
                        {['Provider', 'Sent', 'Failed'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {(s?.byProvider ?? []).map((p) => (
                          <tr key={p.provider} className="border-t border-border-subtle">
                            <td className="px-4 py-2.5"><Badge tone="neutral" size="sm">{p.provider.toUpperCase()}</Badge></td>
                            <td className="px-4 py-2.5 text-strong" data-numeric>{p.sent}</td>
                            <td className="px-4 py-2.5 text-muted" data-numeric>{p.failed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            </PlatformSection>

            {/* Send test */}
            <PlatformSection title="Send a test email">
              <SendTestCard />
            </PlatformSection>
          </>
        )}
      </PageContainer>
    </PageTransition>
  );
}

function SendTestCard() {
  const [to, setTo] = useState('');
  const send = useMutation({
    mutationFn: (address: string) => living.notifications.email.test(address),
    onSuccess: (r) => toast.success(`Sent via ${r.provider.toUpperCase()}${r.messageId ? ` (${r.messageId})` : ''}`),
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not send test email'),
  });
  return (
    <Card variant="elevated" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input label="Recipient" type="email" placeholder="ops@living.local" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button onClick={() => to && send.mutate(to)} loading={send.isPending} disabled={!to}>
        <Send className="h-4 w-4" /> Send test
      </Button>
    </Card>
  );
}
