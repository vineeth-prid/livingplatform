import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, KeyRound, UserPlus, X } from 'lucide-react';
import { LivingApiError, type UnitOwner } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Badge, type BadgeProps, Button, EmptyState, Input, Sheet, SheetContent, Skeleton, toast, useConfirm } from '@living/ui';

import { living } from '../../lib/living';

type Tone = NonNullable<BadgeProps['tone']>;

/**
 * Account status, which is NOT ownership status.
 *
 * Someone can own a flat for years and never open the app. "Not registered" is
 * a fact about the account, not a problem with the ownership, and the admin
 * needs to be able to tell the two apart at a glance.
 */
const ACCOUNT_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  NOT_REGISTERED: 'neutral',
  SUSPENDED: 'danger',
  DEACTIVATED: 'neutral',
};
const ACCOUNT_LABEL: Record<string, string> = {
  ACTIVE: 'Account active',
  PENDING: 'Invitation pending',
  NOT_REGISTERED: 'Not registered',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Inactive',
};

/**
 * Who OWNS this flat — the people the association bills, as opposed to the
 * people who live in it.
 *
 * A separate section from Residents on purpose. An owner may never live here
 * and a tenant is never billed, so merging them into one list is what made
 * maintenance follow occupancy and put a tenant on their landlord's invoice.
 */
export function UnitOwners({ communityId, unitId }: { communityId: string; unitId: string }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);

  const canManage = hasPermission('resident:update');
  const owners = useQuery({
    queryKey: ['unit', unitId, 'owners'],
    queryFn: () => living.people.listUnitOwners(communityId, unitId),
  });

  const end = useMutation({
    mutationFn: (residentId: string) => living.people.endUnitOwner(communityId, unitId, residentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unit', unitId, 'owners'] });
      toast.success('Ownership ended');
    },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Could not update'),
  });

  const onEnd = async (owner: UnitOwner) => {
    const ok = await confirm({
      title: `End ${owner.firstName}’s ownership?`,
      description:
        'The record is kept as history — invoices raised while they owned the flat stay explainable. They stop seeing new maintenance charges.',
      confirmLabel: 'End ownership',
      tone: 'danger',
    });
    if (ok) end.mutate(owner.residentId);
  };

  const rows = owners.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {owners.isLoading ? (
        <Skeleton className="h-16" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Crown}
          title="No owner recorded"
          description="Maintenance for this unit is not yet attached to anyone. Add the owner so charges and reminders reach the right person."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-sunken">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                <KeyRound className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-strong">
                  <Link to={`/residents/${o.residentId}` as string} className="truncate hover:underline">
                    {o.firstName} {o.lastName}
                  </Link>
                  {o.isPrimary && rows.length > 1 && (
                    <Badge tone="brand" size="sm">primary</Badge>
                  )}
                </p>
                <p className="truncate text-xs text-subtle">
                  {o.mobile}
                  {o.email ? ` · ${o.email}` : ''}
                  {o.sharePercent != null ? ` · ${o.sharePercent}%` : ''}
                </p>
              </div>
              <Badge tone={ACCOUNT_TONE[o.accountStatus] ?? 'neutral'} size="sm">
                {ACCOUNT_LABEL[o.accountStatus] ?? o.accountStatus}
              </Badge>
              {canManage && (
                <button
                  type="button"
                  onClick={() => void onEnd(o)}
                  disabled={end.isPending}
                  aria-label={`End ${o.firstName}'s ownership`}
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-tint hover:text-danger-fg disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Add owner
          </Button>
          <p className="mt-1.5 text-xs text-subtle">
            Maintenance charges, reminders and receipts go to the owner — never to a tenant living here.
          </p>
        </div>
      )}

      {adding && (
        <AddOwnerSheet
          open={adding}
          onOpenChange={setAdding}
          communityId={communityId}
          unitId={unitId}
          onSaved={() => void qc.invalidateQueries({ queryKey: ['unit', unitId, 'owners'] })}
        />
      )}
    </div>
  );
}

/**
 * Add an owner: pick someone the community already knows, or enter a new
 * person. Either way they end up as an ordinary resident with an ordinary
 * login — there is no separate owner account, and no duplicate user.
 */
function AddOwnerSheet({
  open, onOpenChange, communityId, unitId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  communityId: string;
  unitId: string;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [search, setSearch] = useState('');
  const [residentId, setResidentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const existing = useQuery({
    queryKey: ['residents', communityId, 'owner-picker', search],
    queryFn: () => living.people.listResidents(communityId, { limit: 10, search }),
    enabled: open && mode === 'existing' && search.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: () =>
      living.people.addUnitOwner(communityId, unitId,
        mode === 'existing'
          ? { residentId }
          : { firstName: firstName.trim(), lastName: lastName.trim() || undefined, mobile: mobile.trim(), email: email.trim() || undefined },
      ),
    onSuccess: () => {
      toast.success(
        mode === 'existing'
          ? 'Owner recorded'
          : 'Owner recorded — their login is the mobile number, password Living@123 (changed on first sign-in)',
      );
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Could not add the owner'),
  });

  const canSubmit = mode === 'existing' ? !!residentId : !!firstName.trim() && !!mobile.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        open={open}
        side="right"
        title="Add owner"
        description="The person financially responsible for this unit. They do not have to live in it."
        className="w-[min(94vw,480px)]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-1.5">
            {([['new', 'New person'], ['existing', 'Already a resident']] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                className={`flex-1 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === v ? 'bg-brand text-white' : 'bg-sunken text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <div>
              <Input
                label="Find the person"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, mobile or resident code"
                hint="Reuses their existing account — never creates a second one."
              />
              <div className="mt-2 flex flex-col gap-1">
                {(existing.data?.items ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResidentId(r.id)}
                    className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      residentId === r.id ? 'bg-tint text-brand' : 'hover:bg-sunken text-body'
                    }`}
                  >
                    {r.firstName} {r.lastName} · <span className="font-mono text-xs">{r.mobile}</span>
                  </button>
                ))}
                {search.trim().length >= 2 && !existing.isLoading && (existing.data?.items ?? []).length === 0 && (
                  <p className="px-1 text-xs text-subtle">Nobody matches. Add them as a new person instead.</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <Input
                label="Mobile (login username)"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                hint="A Resident App login is created — the owner signs in even if a tenant lives here."
              />
              <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </>
          )}

          <Button block loading={add.isPending} disabled={!canSubmit} onClick={() => add.mutate()}>
            Record as owner
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
