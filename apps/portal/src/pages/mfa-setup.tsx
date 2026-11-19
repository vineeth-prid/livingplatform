import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import type { MfaSetup } from '@living/types';
import { Button, Card, Input, toast } from '@living/ui';

import { living } from '../lib/living';

/** Groups a base32 key in fours so it can be typed into an authenticator app. */
const grouped = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();

/**
 * Two-factor enrolment: start → add the key to an authenticator app (Google
 * Authenticator, Microsoft Authenticator, Authy, 1Password…) → confirm with
 * the first code. The API returns a fresh session on confirmation, so a
 * session restricted for enrolment becomes a normal one without signing in.
 */
export function MfaSetupPanel({ onDone }: { onDone?: () => void }) {
  const { refreshSession } = useAuth();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      setSetup(await living.auth.startMfaSetup());
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not start two-factor setup');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await living.auth.enableMfa(code);
      toast.success('Two-factor sign-in is on');
      await refreshSession();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'That code did not work');
    } finally {
      setBusy(false);
    }
  }

  if (!setup) {
    return (
      <Button loading={busy} onClick={() => void start()}>
        Set up two-factor sign-in
      </Button>
    );
  }

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Open an authenticator app on your phone and choose “add account” → “enter a setup key”.</li>
        <li>Enter the key below (account: your email, type: time-based).</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <p className="select-all rounded-control bg-sunken px-4 py-3 text-center font-mono text-base tracking-wider text-strong">
        {grouped(setup.secret)}
      </p>
      <a href={setup.otpauthUrl} className="text-center text-sm text-brand underline-offset-2 hover:underline">
        On this phone? Open in your authenticator app
      </a>
      <Input
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
      />
      <Button type="submit" loading={busy} disabled={code.length !== 6}>
        Turn on two-factor sign-in
      </Button>
    </form>
  );
}

/** Blocking screen when the account's role requires two-factor and it is not set up. */
export function MfaSetupGate() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card variant="elevated" className="w-full max-w-md">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 font-display text-h2 tracking-tight text-strong">
            <ShieldCheck className="h-5 w-5 text-brand" /> Secure your account
          </h2>
          <p className="mt-1 text-sm text-muted">
            Your role requires two-factor sign-in. Set it up once; after that you will enter a code
            from your phone when you sign in.
          </p>
        </div>
        <MfaSetupPanel />
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full text-center text-sm text-muted hover:text-body"
        >
          Sign out
        </button>
      </Card>
    </div>
  );
}

/** Profile card: turn two-factor on, or off (password + current code). */
export function TwoFactorCard() {
  const { session, refreshSession } = useAuth();
  const enabled = !!session?.user?.mfaEnabled;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function disable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await living.auth.disableMfa(password, code);
      toast.success('Two-factor sign-in is off');
      setPassword('');
      setCode('');
      await refreshSession();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not turn two-factor off');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="elevated">
      <h2 className="mb-1 flex items-center gap-2 font-display text-h4 tracking-tight text-strong">
        <ShieldCheck className="h-4 w-4 text-muted" /> Two-factor sign-in
      </h2>
      <p className="mb-4 text-sm text-muted">
        {enabled
          ? 'On. You enter a code from your authenticator app each time you sign in.'
          : 'Add a second step to sign-in: a code from an authenticator app on your phone.'}
      </p>
      {enabled ? (
        <form onSubmit={disable} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="Current code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Button type="submit" variant="ghost" loading={busy}>
            Turn off
          </Button>
        </form>
      ) : (
        <MfaSetupPanel />
      )}
    </Card>
  );
}
