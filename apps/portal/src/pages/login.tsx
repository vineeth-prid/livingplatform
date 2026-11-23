import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Button, ForgotPasswordDialog, Input, LoginShell, installCommunityId, toast, useCommunityBranding,
} from '@living/ui';

import { clearImpersonation } from '../features/admin/impersonation';
import { useCommunity } from '../features/community/community-context';


/**
 * Authentication screen. Uses the SDK via the auth framework — no fetch, no
 * token handling here. Demonstrates the full sign-in path the whole app relies
 * on. (Seeded dev creds: admin@living.local / Living!2024.)
 */
export function LoginPage() {
  const { login, logout, session, status } = useAuth();
  // The community from a `/login?c=<id>` link, or the one last signed in on this device.
  const brand = useCommunityBranding(installCommunityId());
  const navigate = useNavigate();
  const { setCommunityId } = useCommunity();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgot, setForgot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Second step, shown only when the account has two-factor sign-in on.
  const [needsCode, setNeedsCode] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  // A community's own link (`?c=`) must never open the platform console: a
  // platform admin still signed in on this browser is signed out first, so the
  // community's admin gets the sign-in form instead.
  const linkCommunityId = new URLSearchParams(window.location.search).get('c');
  const communityLink = !!linkCommunityId;
  const platformSession = (session?.roles ?? []).some((r) => r.scope === 'PLATFORM');
  const signOutFirst = status === 'authenticated' && communityLink && platformSession;
  useEffect(() => {
    if (signOutFirst) void logout();
  }, [signOutFirst, logout]);

  if (status === 'authenticated' && !signOutFirst) return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password, rememberMe: true, ...(needsCode ? { mfaCode } : {}) });
      // A direct sign-in is never an impersonation — no way back to a platform session.
      clearImpersonation();
      // Open the community the link was for (ignored if this admin has no access to it).
      if (linkCommunityId) setCommunityId(linkCommunityId);
      toast.success('Welcome back');
      navigate({ to: '/' });
    } catch (err) {
      if (err instanceof LivingApiError && err.error === 'MfaRequiredException') {
        setNeedsCode(true);
        toast.message(err.message);
        return;
      }
      const message = err instanceof LivingApiError ? err.message : 'Unable to sign in';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LoginShell split brand={brand} title="Sign in"
      subtitle={`Welcome back to ${brand?.name ?? 'Living'}.`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email or mobile"
          type="text"
          autoComplete="username"
          placeholder="you@community.com or 9876543210"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {needsCode && (
          <Input
            label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        )}
        <Button type="submit" block loading={submitting} className="mt-1">
          Sign in
        </Button>
        <button
          type="button"
          onClick={() => setForgot(true)}
          className="text-center text-sm text-brand underline-offset-2 hover:underline"
        >
          Forgot password?
        </button>
      </form>
      <ForgotPasswordDialog open={forgot} onClose={() => setForgot(false)} />
    </LoginShell>
  );
}
