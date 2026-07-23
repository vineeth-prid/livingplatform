import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { LivingApiError, type ProvisionCommunityResult } from '@living/living-sdk';
import {
  Badge, Button, Card, EmptyState, LoadingState, PageContainer, PageHeader,
  PageTransition, toast,
} from '@living/ui';
import { Building2, Copy, KeyRound, LogIn, Plus } from 'lucide-react';

import { living } from '../../lib/living';
import { beginImpersonation, cancelImpersonation } from './impersonation';
import { ProvisionCommunityForm } from './provision-community-form';
import { StatusBadge } from '../master-data';

const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/**
 * Platform-Admin control plane: every community across all tenants, and the
 * one-flow provisioning of a new community + its Association Admin. Associations
 * cannot reach this — it's the operator's oversight of what exists "under him".
 */
export function AdminCommunitiesPage() {
  const [provisioning, setProvisioning] = useState(false);
  const [credentials, setCredentials] = useState<ProvisionCommunityResult['admin'] | null>(null);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: qk.communities({ limit: 100 }),
    queryFn: () => living.community.list({ limit: 100, sortBy: 'name', sortDir: 'asc' }),
  });

  const communities = data?.items ?? [];

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
  };

  // Swap into the community admin's session; a full reload re-bootstraps the app
  // as that admin. The banner (dashboard shell) offers the return trip.
  const loginAs = async (id: string, name: string) => {
    setLoggingInId(id);
    beginImpersonation(name);
    try {
      await living.platform.loginAsCommunity(id);
      window.location.assign('/');
    } catch (err) {
      cancelImpersonation();
      setLoggingInId(null);
      toast.error(err instanceof LivingApiError ? err.message : 'Could not sign in as this community');
    }
  };

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="Communities"
          description="Every community across all customers. Provision a new one and its association admin here."
          actions={
            <Button onClick={() => setProvisioning(true)}>
              <Plus className="h-4 w-4" /> Provision community
            </Button>
          }
        />

        {credentials && (
          <Card variant="elevated" className="mb-6 flex flex-col gap-3 border-brand/30">
            <div className="flex items-center gap-2 text-strong">
              <KeyRound className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold">Association admin created — share these once</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CredField label="Email" value={credentials.email} onCopy={copy} />
              <CredField label="Temporary password" value={credentials.temporaryPassword} onCopy={copy} mono />
            </div>
            <p className="text-xs text-subtle">
              The password is shown only now. They sign in and should change it immediately.
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={() => setCredentials(null)}>Dismiss</Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <LoadingState />
        ) : communities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No communities yet"
            description="Provision your first community and its association admin to get started."
            action={<Button onClick={() => setProvisioning(true)}><Plus className="h-4 w-4" /> Provision community</Button>}
          />
        ) : (
          <Card variant="elevated" padded={false} className="overflow-hidden">
            <ul className="flex flex-col divide-y divide-border-subtle">
              {communities.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <span className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted" />
                    <span className="text-sm font-medium text-strong">{c.name}</span>
                    <span className="font-mono text-xs text-subtle">{c.code}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden text-xs text-subtle sm:inline">
                      {[c.city, c.state].filter(Boolean).join(', ')}
                    </span>
                    <Badge tone="neutral" size="sm">{typeLabel(c.type)}</Badge>
                    <StatusBadge status={c.status} />
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={loggingInId === c.id}
                      onClick={() => loginAs(c.id, c.name)}
                    >
                      <LogIn className="h-4 w-4" /> Log in as admin
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <ProvisionCommunityForm
          open={provisioning}
          onOpenChange={setProvisioning}
          onProvisioned={(r) => setCredentials(r.admin)}
        />
      </PageContainer>
    </PageTransition>
  );
}

function CredField({
  label, value, onCopy, mono,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <div className="flex items-center gap-2">
        <code className={`flex-1 truncate rounded-control bg-sunken px-2.5 py-1.5 text-sm text-strong ${mono ? 'font-mono' : ''}`}>
          {value}
        </code>
        <Button variant="ghost" size="sm" onClick={() => onCopy(value)} aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
