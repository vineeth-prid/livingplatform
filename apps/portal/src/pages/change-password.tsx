import { useState, type FormEvent } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, Card, Input, toast } from '@living/ui';

import { living } from '../lib/living';

/**
 * Forced first-login password change. Shown (blocking the app) whenever the
 * signed-in user has `mustChangePassword` — accounts provisioned with the common
 * one-time password (Living@123). On success the session is refreshed.
 */
export function ChangePasswordGate() {
  const { refreshSession, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      toast.error('Use at least 8 characters with a letter and a number');
      return;
    }
    setSubmitting(true);
    try {
      await living.auth.changePassword(currentPassword, password);
      toast.success('Password updated');
      await refreshSession();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not change password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card variant="elevated" className="w-full max-w-sm">
        <div className="mb-6">
          <h2 className="font-display text-h2 tracking-tight text-strong">Set a new password</h2>
          <p className="mt-1 text-sm text-muted">
            For your security, choose a new password before continuing.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Current password" type="password" autoComplete="current-password"
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <Input label="New password" type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Confirm new password" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <Button type="submit" block loading={submitting} className="mt-1">Update password</Button>
          <button type="button" onClick={() => void logout()} className="text-sm text-muted hover:text-body">
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
