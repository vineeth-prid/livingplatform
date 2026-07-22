import { useNavigate } from '@tanstack/react-router';
import { Building2, LogOut, Moon, ShieldCheck } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { useTheme } from '@living/design-system';
import { initials } from '@living/utils';
import { Badge, Button, Card, useConfirm } from '@living/ui';

import { Section } from '../components';
import { useWorker } from '../worker';
import { ScreenHeader } from '../shell';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function ProfileScreen() {
  const { session, logout } = useAuth();
  const { community, staff, vendor } = useWorker();
  const { mode, setMode } = useTheme();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const user = session?.user;
  const name = user ? `${user.firstName} ${user.lastName}` : 'Worker';
  const role = staff ? humanize(staff.role) : vendor ? `Vendor · ${humanize(vendor.category)}` : null;
  const org = vendor?.companyName ?? vendor?.name ?? null;

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
          <div className="min-w-0">
            <p className="font-display text-h3 leading-none tracking-tight text-strong">{name}</p>
            <p className="mt-1 truncate text-sm text-muted">{user?.email}</p>
            {org && <p className="truncate text-xs text-subtle">{org}</p>}
          </div>
        </Card>

        <Section title="Role & site">
          <Card variant="elevated" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5 text-sm text-body"><ShieldCheck className="h-4 w-4 text-muted" /> Role</span>
              {role ? <Badge tone="brand">{role}</Badge> : <span className="text-sm text-subtle">Not linked</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5 text-sm text-body"><Building2 className="h-4 w-4 text-muted" /> Community</span>
              <span className="text-sm text-strong">{community?.name ?? '—'}</span>
            </div>
          </Card>
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

        <Button variant="secondary" block size="lg" className="mt-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <p className="mt-6 pb-4 text-center text-2xs uppercase tracking-wider text-subtle">Living · Life Happens Here.</p>
      </div>
    </div>
  );
}
