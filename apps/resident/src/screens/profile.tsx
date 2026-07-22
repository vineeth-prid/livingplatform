import { useNavigate } from '@tanstack/react-router';
import { Bell, DoorOpen, LogOut, Moon, Users } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { useTheme } from '@living/design-system';
import { initials } from '@living/utils';
import { Button, Card, useConfirm } from '@living/ui';

import { useResidentCommunity } from '../community';
import { Section, SoftPlaceholder } from '../components';
import { ScreenHeader } from '../shell';

export function ProfileScreen() {
  const { session, logout } = useAuth();
  const { community } = useResidentCommunity();
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
            <p className="mt-1 text-sm text-muted">{user?.email}</p>
            {community && <p className="text-xs text-subtle">{community.name}</p>}
          </div>
        </Card>

        <Section title="My home">
          <SoftPlaceholder icon={DoorOpen} title="Linked units" note="Your units appear here once linked to your account." />
          <div className="mt-2">
            <SoftPlaceholder icon={Users} title="Family members" note="Add household members in a future update." />
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
          <SoftPlaceholder icon={Bell} title="Notifications" note="Choose what you hear about — coming soon." />
        </Section>

        <Button variant="secondary" block size="lg" className="mt-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <p className="mt-6 pb-4 text-center text-2xs uppercase tracking-wider text-subtle">Living · Life Happens Here.</p>
      </div>
    </div>
  );
}
