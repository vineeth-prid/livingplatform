import { useState, type FormEvent } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth, useLiving } from '@living/hooks';

import { Button } from './button';
import { Input } from './input';
import { toast } from '../providers/toast';

/**
 * Blocking first-sign-in screen for the mobile apps (resident, workforce).
 *
 * Accounts are provisioned or reset with a one-time password, and the API now
 * refuses every other route until it is replaced — so this screen is what the
 * person sees instead of the app. On success the API returns a fresh session
 * (stored by the SDK) and the app continues without signing in again.
 *
 * Also covers the rarer "two-factor required" restriction, which is set up in
 * the admin portal rather than on a phone app.
 */
export function PasswordChangeGate({ mfaSetupRequired = false }: { mfaSetupRequired?: boolean }) {
  const living = useLiving();
  const { refreshSession, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      toast.error('Use at least 8 characters with a letter and a number');
      return;
    }
    setBusy(true);
    try {
      await living.auth.changePassword(currentPassword, password);
      toast.success('Password updated');
      await refreshSession();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-page px-6 py-10">
      {mfaSetupRequired ? (
        <div>
          <h1 className="font-display text-h2 tracking-tight text-strong">Two-factor sign-in required</h1>
          <p className="mt-2 text-sm text-muted">
            Your role requires two-factor sign-in. Sign in to the admin portal once to set it up, then
            come back here.
          </p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="font-display text-h2 tracking-tight text-strong">Set your password</h1>
            <p className="mt-2 text-sm text-muted">
              You signed in with a one-time password. Choose your own to continue.
            </p>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input label="One-time password" type="password" autoComplete="current-password"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <Input label="New password" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
              hint="At least 8 characters, with a letter and a number." />
            <Input label="Confirm new password" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <Button type="submit" size="lg" block loading={busy}>Save password</Button>
          </form>
        </>
      )}
      <button type="button" onClick={() => void logout()} className="text-center text-sm text-muted hover:text-body">
        Sign out
      </button>
    </div>
  );
}
