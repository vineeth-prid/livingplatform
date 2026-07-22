import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, Input, toast } from '@living/ui';

/** Consumer sign-in — warm, minimal, big touch targets. */
export function LoginScreen() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login({ email, password, rememberMe: true });
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
          Welcome home.
        </h1>
        <p className="mt-3 text-muted">Everything your community offers, in one calm place.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" inputMode="email" autoComplete="email"
          placeholder="you@home.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" autoComplete="current-password"
          placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" size="lg" block loading={busy} className="mt-2">Sign in</Button>
        <p className="text-center text-xs text-subtle">Life Happens Here.</p>
      </form>
    </div>
  );
}
