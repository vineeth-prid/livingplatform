import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Button, ForgotPasswordDialog, Input, LoginShell, installCommunityId, toast, useCommunityBranding,
} from '@living/ui';

/**
 * Worker sign-in — plain, high-contrast, big touch targets.
 *
 * Staff and vendors are provisioned with their MOBILE NUMBER as the username
 * (AccountProvisioningService), exactly like residents. This field previously
 * carried `type="email"`, so a guard typing "9876543210" tripped the browser's
 * native email validation and the form silently refused to submit — the API had
 * always accepted it. Keep this an untyped text input with a tel inputMode: the
 * same field still accepts an email for managers and admins.
 */
export function LoginScreen() {
  const { login, status } = useAuth();
  const brand = useCommunityBranding(installCommunityId());
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  // Second step, only for accounts with two-factor sign-in on.
  const [needsCode, setNeedsCode] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  if (status === 'authenticated') return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // The API's `email` field is really an identifier — it matches on email
      // OR on the digits-only username.
      await login({ email: identifier.trim(), password, rememberMe: true, ...(needsCode ? { mfaCode } : {}) });
      navigate({ to: '/' });
    } catch (err) {
      if (err instanceof LivingApiError && err.error === 'MfaRequiredException') {
        setNeedsCode(true);
        toast.message(err.message);
        return;
      }
      toast.error(err instanceof LivingApiError ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LoginShell brand={brand} eyebrow="Staff & vendors" title="Ready for work."
      subtitle="Your assigned jobs, wherever the day takes you.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Mobile number" inputMode="tel" autoComplete="username"
          placeholder="9876543210" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
          hint="Your registered mobile number is your username." />
        <Input label="Password" type="password" autoComplete="current-password"
          placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {needsCode && (
          <Input label="Authenticator code" inputMode="numeric" autoComplete="one-time-code"
            placeholder="6-digit code" maxLength={6} value={mfaCode} autoFocus required
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} />
        )}
        <Button type="submit" size="lg" block loading={busy} className="mt-2">Sign in</Button>
        {/* Self-service recovery. The dialog now takes its client from the SDK
            context rather than a module-level one, so the same implementation
            serves all three apps — a worker no longer has to ring an admin to
            get back in. */}
        <button
          type="button"
          onClick={() => setForgot(true)}
          className="text-center text-sm text-muted underline-offset-2 hover:underline"
        >
          Forgot your password?
        </button>
      </form>
      <ForgotPasswordDialog open={forgot} onClose={() => setForgot(false)} />
    </LoginShell>
  );
}
