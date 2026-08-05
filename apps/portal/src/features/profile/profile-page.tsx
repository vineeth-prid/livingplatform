import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, Input, LoadingState, PageContainer, PageHeader, PageTransition, toast,
} from '@living/ui';

import { living } from '../../lib/living';
import { FormGrid, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';

const THEMES = [
  { value: 'SYSTEM', label: 'Match my system' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
];

/**
 * The signed-in admin's own account.
 *
 * The header's Profile menu item used to be an inert placeholder — no handler,
 * no route — so clicking it did nothing at all. This is the page it should
 * always have opened.
 */
export function ProfilePage() {
  const { session } = useAuth();
  const qc = useQueryClient();

  const profile = useQuery({ queryKey: ['profile', 'me'], queryFn: () => living.profile.me() });

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [theme, setTheme] = useState('SYSTEM');
  const [timezone, setTimezone] = useState('');

  // Seed once the document arrives; the form is uncontrolled until then.
  useEffect(() => {
    const p = profile.data?.profile;
    if (!p) return;
    setDisplayName(p.displayName ?? '');
    setPhone(p.phone ?? '');
    setBio(p.bio ?? '');
    setTheme(p.theme ?? 'SYSTEM');
    setTimezone(p.timezone ?? 'Asia/Kolkata');
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      living.profile.update({
        displayName: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
        theme: theme as 'LIGHT' | 'DARK' | 'SYSTEM',
        timezone: timezone.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (profile.isLoading) return <LoadingState label="Loading your profile…" />;
  const me = profile.data;
  if (!me) return <LoadingState label="Profile unavailable" />;

  const roles = session?.user.roles ?? [];

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          title="My profile"
          description="Your account details and preferences. Only you can see this page."
        />

        <Card variant="elevated" className="mb-6">
          <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Account</h2>
          <p className="mb-4 text-sm text-muted">
            Name and email are managed by your administrator.
          </p>
          <FormGrid>
            <Input label="Name" value={`${me.firstName} ${me.lastName}`} readOnly disabled />
            <Input label="Email" value={me.email} readOnly disabled />
          </FormGrid>
          {roles.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs uppercase tracking-wider text-subtle">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <Badge key={role} tone="brand" size="sm">
                    {role.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card variant="elevated" className="mb-6">
          <h2 className="mb-1 font-display text-h4 tracking-tight text-strong">Preferences</h2>
          <p className="mb-4 text-sm text-muted">How the portal addresses and displays things.</p>
          <FormGrid>
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={me.firstName}
              hint="Shown instead of your full name where space is tight."
            />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <SelectField label="Theme" value={theme} onChange={setTheme} options={THEMES} />
            <Input
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
            />
            <FullWidth>
              <TextAreaField label="Bio" value={bio} onChange={setBio} rows={3} />
            </FullWidth>
          </FormGrid>
          <div className="mt-4 flex justify-end">
            <Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
          </div>
        </Card>

        <ChangePasswordCard />
      </PageContainer>
    </PageTransition>
  );
}

/** Changing your own password — requires the current one, unlike an admin reset. */
function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useMutation({
    mutationFn: () => living.auth.changePassword(current, next),
    onSuccess: () => {
      setCurrent(''); setNext(''); setConfirm('');
      toast.success('Password changed');
    },
    onError: (err) =>
      toast.error(err instanceof LivingApiError ? err.message : 'Could not change the password'),
  });

  // Checked here as well as server-side, so a mistyped confirmation costs a
  // glance rather than a round-trip and an error toast.
  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length > 0 && next === confirm;

  return (
    <Card variant="elevated">
      <h2 className="mb-1 flex items-center gap-2 font-display text-h4 tracking-tight text-strong">
        <KeyRound className="h-4 w-4 text-muted" /> Password
      </h2>
      <p className="mb-4 text-sm text-muted">
        Changing your password signs you out of your other devices.
      </p>
      <FormGrid>
        <FullWidth>
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </FullWidth>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? 'Passwords do not match' : undefined}
        />
      </FormGrid>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-subtle">
          <ShieldCheck className="h-3.5 w-3.5" /> Your administrator can reset this if you are locked out.
        </span>
        <Button loading={change.isPending} disabled={!canSubmit} onClick={() => change.mutate()}>
          Change password
        </Button>
      </div>
    </Card>
  );
}
