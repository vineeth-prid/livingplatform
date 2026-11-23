import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Button, ForgotPasswordDialog, Input, LoginShell, installCommunityId, toast, useCommunityBranding,
} from '@living/ui';


/** Consumer sign-in — warm, minimal, big touch targets. Residents sign in with
 *  their mobile number; the field still accepts an email for staff/admins. */
export function LoginScreen() {
  const { login, status } = useAuth();
  const brand = useCommunityBranding(installCommunityId());
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
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
      await login({ email, password, rememberMe: true, ...(needsCode ? { mfaCode } : {}) });
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
    <LoginShell brand={brand} eyebrow="Residents" title="Welcome home."
      subtitle="Everything your community offers, in one calm place.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Mobile number" inputMode="tel" autoComplete="username"
          placeholder="9876543210" value={email} onChange={(e) => setEmail(e.target.value)} required
          hint="Your registered mobile number is your username." />
        <Input label="Password" type="password" autoComplete="current-password"
          placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {needsCode && (
          <Input label="Authenticator code" inputMode="numeric" autoComplete="one-time-code"
            placeholder="6-digit code" maxLength={6} value={mfaCode} autoFocus required
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} />
        )}
        <Button type="submit" size="lg" block loading={busy} className="mt-2">Sign in</Button>
        <button type="button" onClick={() => setForgot(true)}
          className="text-center text-sm text-brand underline-offset-2 hover:underline">
          Forgot password?
        </button>
      </form>
      <ForgotPasswordDialog open={forgot} onClose={() => setForgot(false)} />
    </LoginShell>
  );
}
