import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, Card, Input, toast } from '@living/ui';

/**
 * Authentication screen. Uses the SDK via the auth framework — no fetch, no
 * token handling here. Demonstrates the full sign-in path the whole app relies
 * on. (Seeded dev creds: admin@living.local / Living!2024.)
 */
export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password, rememberMe: true });
      toast.success('Welcome back');
      navigate({ to: '/' });
    } catch (err) {
      const message = err instanceof LivingApiError ? err.message : 'Unable to sign in';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Editorial brand panel */}
      <div className="relative hidden flex-col justify-between bg-pine-800 p-12 lg:flex">
        <span className="font-display text-2xl text-stone-50">
          Living<span className="text-clay-400">.</span>
        </span>
        <div>
          <h1 className="font-display text-display-lg leading-tight tracking-tight text-stone-50">
            Life Happens Here.
          </h1>
          <p className="mt-4 max-w-md text-pine-100">
            A calm operating system for residential communities.
          </p>
        </div>
        <p className="text-2xs uppercase tracking-wider text-pine-200">Living · Since 2024</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <Card variant="elevated" className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="font-display text-h2 tracking-tight text-strong">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Welcome back to Living.</p>
          </div>
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
            <Button type="submit" block loading={submitting} className="mt-1">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
