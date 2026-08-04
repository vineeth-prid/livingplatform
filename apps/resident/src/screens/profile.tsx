import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Bell, BellOff, ChevronRight, DoorOpen, LogOut, Moon, Package, Trash2, UserPlus, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useCommunityFeatures } from '@living/hooks';
import { useTheme } from '@living/design-system';
import { LivingApiError } from '@living/living-sdk';
import { initials } from '@living/utils';
import { Button, Card, Input, Sheet, SheetContent, Skeleton, toast, useConfirm } from '@living/ui';
import type { Resident } from '@living/types';

import { useResidentCommunity } from '../community';
import { useFamilyMutations, useMyResident } from '../community-ops';
import { Section, SoftPlaceholder } from '../components';
import { InstallButton } from '../pwa/install';
import { usePush } from '../pwa/use-push';
import { ScreenHeader } from '../shell';

/**
 * Accounts provisioned from a mobile number get a synthetic
 * `<digits>@living.local` email so the user table stays unique-by-email. It is
 * a database detail, never something to show a resident — their phone number is
 * what they actually signed in with.
 */
export function contactLine(email?: string, mobile?: string | null): string {
  if (mobile) return mobile;
  if (!email) return '';
  const synthetic = email.match(/^(\d{7,})@living\.local$/i);
  return synthetic ? synthetic[1]! : email;
}

export function ProfileScreen() {
  const { session, logout } = useAuth();
  const { community, communityId } = useResidentCommunity();
  const features = useCommunityFeatures(communityId);
  const { resident, units, family, isLoading: residentLoading } = useMyResident();
  const { mode, setMode } = useTheme();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const user = session?.user;
  const name = user ? `${user.firstName} ${user.lastName}` : 'Resident';

  async function signOut() {
    if (!(await confirm({ title: 'Sign out?', confirmLabel: 'Sign out' }))) return;
    await logout();
    navigate({ to: '/login' });
  }

  return (
    <div>
      <ScreenHeader title="Profile" subtitle="You" />
      <div className="px-4">
        <Card variant="elevated" className="mb-6 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-tint font-display text-h3 text-[var(--text-on-tint)]">
            {initials(name)}
          </span>
          <div>
            <p className="font-display text-h3 leading-none tracking-tight text-strong">{name}</p>
            <p className="mt-1 text-sm text-muted" data-numeric>
              {contactLine(user?.email, resident?.mobile)}
            </p>
            {community && <p className="text-xs text-subtle">{community.name}</p>}
          </div>
        </Card>

        <Section title="My home">
          {residentLoading ? (
            <Skeleton className="h-16 rounded-card" />
          ) : units.length === 0 ? (
            <SoftPlaceholder icon={DoorOpen} title="Linked units" note="Your units appear here once linked to your account." />
          ) : (
            <div className="flex flex-col gap-2">
              {units.map((u) => (
                <Card key={u.id} variant="elevated" className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                    <DoorOpen className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-strong" data-numeric>{u.unitNumber}</p>
                    <p className="text-xs text-subtle">{community?.name ?? 'Your unit'}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-2">
            <FamilyMembers members={family} canAdd={units.length > 0} loading={residentLoading} />
          </div>
        </Section>

        <Section title="Appearance">
          <Card variant="elevated" className="flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-sm text-body"><Moon className="h-4 w-4 text-muted" /> Theme</span>
            <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1">
              {(['light', 'system', 'dark'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                  className={`rounded-pill px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mode === m ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted'}`}>
                  {m}
                </button>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Notifications">
          <PushToggle />
        </Section>

        <Section title="My purchases">
          {features.servicePackages && (
            <ProfileLink to="/packages" icon={Package} label="My packages" />
          )}
          {features.maintenanceBilling && (
            <ProfileLink to="/maintenance" icon={Wallet} label="Maintenance & payments" />
          )}
          {!features.servicePackages && !features.maintenanceBilling && (
            <SoftPlaceholder
              icon={Wallet}
              title="Nothing to show"
              note="Your community does not use Living for payments."
            />
          )}
        </Section>

        <Section title="App">
          <InstallButton />
        </Section>

        <Button variant="secondary" block size="lg" className="mt-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <p className="mt-6 pb-4 text-center text-2xs uppercase tracking-wider text-subtle">Living · Life Happens Here.</p>
      </div>
    </div>
  );
}

/**
 * Web Push opt-in for this device.
 *
 * The permission prompt fires ONLY from this button. Browsers permanently
 * penalise a site that asks unprompted, and a resident who has not yet seen why
 * they would want it says no — which cannot be undone from inside the app.
 */
function PushToggle() {
  const { state, subscribe, unsubscribe, busy } = usePush();

  if (state === 'loading') return <Skeleton className="h-16 rounded-card" />;

  if (state === 'unsupported' || state === 'unconfigured') {
    return (
      <SoftPlaceholder
        icon={Bell}
        title="Gate alerts"
        note={
          state === 'unsupported'
            ? 'This browser cannot show notifications when Living is closed. Alerts still appear while the app is open.'
            : 'Background alerts are not switched on for your community yet. You will still see deliveries while the app is open.'
        }
      />
    );
  }

  if (state === 'denied') {
    return (
      <Card variant="elevated">
        <p className="flex items-center gap-2.5 text-sm text-body">
          <BellOff className="h-4 w-4 text-muted" /> Notifications are blocked
        </p>
        <p className="mt-1 text-xs text-muted">
          Living cannot alert you to a delivery when the app is closed. Allow notifications for
          this site in your browser settings to turn them back on.
        </p>
      </Card>
    );
  }

  const subscribed = state === 'subscribed';
  return (
    <Card variant="elevated" className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="flex items-center gap-2.5 text-sm text-body">
          <Bell className="h-4 w-4 text-muted" /> Gate &amp; delivery alerts
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          {subscribed
            ? 'On for this device — you will be alerted even when Living is closed.'
            : 'Get alerted the moment a delivery reaches your gate.'}
        </span>
      </span>
      <Button
        size="sm"
        variant={subscribed ? 'secondary' : 'primary'}
        loading={busy}
        onClick={() => void (subscribed ? unsubscribe() : subscribe())}
      >
        {subscribed ? 'Turn off' : 'Turn on'}
      </Button>
    </Card>
  );
}

/**
 * The household sharing this unit.
 *
 * Adding one provisions a real login: their mobile number becomes the username
 * with the standard one-time password, forced to change on first sign-in — the
 * same account flow management uses, so nothing bespoke to maintain.
 */
function FamilyMembers({
  members,
  canAdd,
  loading,
}: {
  members: Resident[];
  canAdd: boolean;
  loading: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const { remove } = useFamilyMutations();
  const confirm = useConfirm();

  const onRemove = async (m: Resident) => {
    if (!(await confirm({
      title: `Remove ${m.firstName}?`,
      description: 'They lose access to this unit in the Living app.',
      tone: 'danger',
      confirmLabel: 'Remove',
    }))) return;
    try {
      await remove.mutateAsync(m.id);
      toast.success('Removed');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not remove');
    }
  };

  if (loading) return <Skeleton className="h-16 rounded-card" />;

  return (
    <>
      {members.length === 0 ? (
        <SoftPlaceholder
          icon={Users}
          title="Family members"
          note={canAdd ? 'Add the people who live with you.' : 'Available once your unit is linked.'}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <Card key={m.id} variant="elevated" className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint font-medium text-[var(--text-on-tint)]">
                {initials(`${m.firstName} ${m.lastName}`)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-strong">
                  {m.firstName} {m.lastName}
                </p>
                <p className="truncate text-xs text-subtle" data-numeric>{m.mobile}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(m)}
                aria-label={`Remove ${m.firstName}`}
                className="rounded-md p-2 text-subtle transition-colors hover:text-danger-fg"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {canAdd && (
        <Button variant="secondary" block className="mt-2" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" /> Add family member
        </Button>
      )}
      <AddFamilySheet open={adding} onOpenChange={setAdding} />
    </>
  );
}

function AddFamilySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { add } = useFamilyMutations();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!firstName.trim() || !mobile.trim()) {
      toast.error('Name and mobile number are required');
      return;
    }
    setBusy(true);
    try {
      await add.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        mobile: mobile.trim(),
      });
      toast.success('Added — they can sign in with their mobile number');
      onOpenChange(false);
      setFirstName('');
      setLastName('');
      setMobile('');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="bottom" title="Add family member" className="max-h-[88dvh]">
        <div className="flex flex-col gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Aisha" />
          <Input label="Last name (optional)" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Khan" />
          <Input label="Mobile" type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98765 43210" />
          <p className="text-xs text-subtle">
            They can sign in to Living with this mobile number. The app asks them to set
            their own password the first time.
          </p>
          <Button size="lg" block loading={busy} onClick={submit} className="mt-1">
            Add member
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A tappable row that navigates — used for the resident's purchase surfaces. */
function ProfileLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="mb-2 block rounded-card last:mb-0 focus-visible:outline-none focus-visible:shadow-ring"
    >
      <Card variant="elevated" className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm text-body">{label}</span>
        <ChevronRight className="h-4 w-4 text-subtle" />
      </Card>
    </Link>
  );
}
