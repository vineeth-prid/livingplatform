import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, Input, toast } from '@living/ui';

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
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // The API's `email` field is really an identifier — it matches on email
      // OR on the digits-only username.
      await login({ email: identifier.trim(), password, rememberMe: true });
      navigate({ to: '/' });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-between bg-page px-6 py-10">
      <div className="pt-10">
        <span className="font-display text-3xl text-strong">Living<span className="text-accent">.</span></span>
        <h1 className="mt-8 font-display text-display-lg leading-tight tracking-tight text-strong">
          Ready for work.
        </h1>
        <p className="mt-3 text-muted">Your assigned jobs, wherever the day takes you.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Mobile number" inputMode="tel" autoComplete="username"
          placeholder="9876543210" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
          hint="Your registered mobile number is your username." />
        <Input label="Password" type="password" autoComplete="current-password"
          placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" size="lg" block loading={busy} className="mt-2">Sign in</Button>
        {/* No self-service recovery here yet — the resident app's OTP dialog is
            bound to its own SDK client, so sharing it needs a lift into a
            package rather than a copy. Admins reset workforce passwords today. */}
        <p className="text-center text-xs text-subtle">Life Happens Here.</p>
      </form>
    </div>
  );
}
