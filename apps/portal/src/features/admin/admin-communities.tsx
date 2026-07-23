import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import { LivingApiError, type ProvisionCommunityResult } from '@living/living-sdk';
import type { Community } from '@living/types';
import {
  Badge, Button, Card, EmptyState, LoadingState, PageContainer, PageHeader,
  PageTransition, toast,
} from '@living/ui';
import { Building2, Copy, KeyRound, LogIn, Pencil, Plus, Power } from 'lucide-react';

import { living } from '../../lib/living';
import { beginImpersonation, cancelImpersonation } from './impersonation';
import { CommunityEditForm } from './community-edit-form';
import { ProvisionCommunityForm } from './provision-community-form';
import { StatusBadge } from '../master-data';
import { Tabs } from '../shared/tabs';

const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/**
 * Platform-Admin control plane: every community across all tenants, and the
 * one-flow provisioning of a new community + its Association Admin. Associations
 * cannot reach this — it's the operator's oversight of what exists "under him".
 */
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

export function AdminCommunitiesPage() {
  const qc = useQueryClient();
  const [provisioning, setProvisioning] = useState(false);
  const [credentials, setCredentials] = useState<ProvisionCommunityResult['admin'] | null>(null);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Community | null>(null);
  const [tab, setTab] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: qk.communities({ limit: 100 }),
    queryFn: () => living.community.list({ limit: 100, sortBy: 'name', sortDir: 'asc' }),
  });

  const toggleStatus = useMutation({
    mutationFn: (c: Community) =>
      living.community.update(c.id, { status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['communities'] }); toast.success('Status updated'); },
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not update status'),
  });

  const all = data?.items ?? [];
  const communities = all.filter((c) =>
    tab === 'all' ? true : tab === 'active' ? c.status === 'ACTIVE' : c.status !== 'ACTIVE');

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

        <div className="mb-4">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>

        {isLoading ? (
          <LoadingState />
        ) : communities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No communities"
            description="Provision your first community and its association admin to get started."
            action={<Button onClick={() => setProvisioning(true)}><Plus className="h-4 w-4" /> Provision community</Button>}
          />
        ) : (
          <Card variant="elevated" padded={false} className="overflow-hidden">
            <ul className="flex flex-col divide-y divide-border-subtle">
              {communities.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <button type="button" onClick={() => setEditing(c)}
                    className="flex items-center gap-3 text-left transition-colors hover:text-brand">
                    <Building2 className="h-4 w-4 text-muted" />
                    <span className="text-sm font-medium text-strong">{c.name}</span>
                    <span className="font-mono text-xs text-subtle">{c.code}</span>
                  </button>
                  <span className="flex items-center gap-2">
                    <span className="hidden text-xs text-subtle sm:inline">
                      {[c.city, c.state].filter(Boolean).join(', ')}
                    </span>
                    <Badge tone="neutral" size="sm">{typeLabel(c.type)}</Badge>
                    <StatusBadge status={c.status} />
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      loading={toggleStatus.isPending && toggleStatus.variables?.id === c.id}
                      onClick={() => toggleStatus.mutate(c)}
                      aria-label={c.status === 'ACTIVE' ? `Deactivate ${c.name}` : `Activate ${c.name}`}
                    >
                      <Power className={`h-4 w-4 ${c.status === 'ACTIVE' ? 'text-success-fg' : 'text-muted'}`} />
                      {c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
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
        {editing && (
          <CommunityEditForm
            community={editing}
            open={!!editing}
            onOpenChange={(o) => !o && setEditing(null)}
          />
        )}
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
