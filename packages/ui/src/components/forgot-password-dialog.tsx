import { useState, type FormEvent } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { useLiving } from '@living/hooks';

import { Button } from './button';
import { Dialog, DialogContent } from './dialog';
import { Input } from './input';
import { toast } from '../providers/toast';

type Step = 'identify' | 'otp' | 'link-sent';

/**
 * Password recovery, one implementation for every app.
 *
 * It lived twice — once in the portal, once in the resident app — and the
 * workforce app had none at all, because each copy was bound to its own module
 * -level SDK client. Taking the client from `useLiving()` removes that binding,
 * so a staff member can recover their own password instead of ringing an admin.
 *
 * Two paths, and the API says which: an emailed link for an account with no
 * mobile number, a one-time code for everyone provisioned with a phone-number
 * login. The code screen submits the SAME identifier that asked for the code —
 * the account may have been found by email.
 */
export function ForgotPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const living = useLiving();
  const [step, setStep] = useState<Step>('identify');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep('identify');
    setIdentifier('');
    setCode('');
    setPassword('');
    onClose();
  }

  async function request(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await living.auth.forgotPassword(identifier.trim());
      toast.success(result.message);
      setStep(result.channel === 'otp' ? 'otp' : 'link-sent');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await living.auth.resetPasswordWithOtp(identifier.trim(), code.trim(), password);
      toast.success('Password changed — sign in with your new password');
      reset();
    } catch (err) {
      toast.error(
        err instanceof LivingApiError ? err.message : 'That code is invalid or has expired',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && reset()}>
      <DialogContent
        open={open}
        className="max-w-md"
        title="Reset your password"
        description={
          step === 'identify'
            ? 'Enter the email or mobile number you sign in with and we will send you a code.'
            : step === 'otp'
              ? `We sent a code to ${identifier}. Enter it below with your new password.`
              : undefined
        }
      >
        {step === 'identify' && (
          <form onSubmit={request} className="flex flex-col gap-4">
            <Input
              label="Email or mobile number"
              inputMode="text"
              autoComplete="username"
              placeholder="you@community.com or 9876543210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <Button type="submit" size="lg" block loading={busy}>
              Send code
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={confirm} className="flex flex-col gap-4">
            <Input
              label="Code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="482913"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters, with a number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" size="lg" block loading={busy}>
              Set new password
            </Button>
            <button
              type="button"
              className="text-sm text-muted underline-offset-2 hover:underline"
              onClick={() => setStep('identify')}
            >
              Use a different email or number
            </button>
          </form>
        )}

        {step === 'link-sent' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-body">
              If that account exists, a reset link is on its way. Open it on this device to choose a
              new password.
            </p>
            <Button size="lg" block onClick={reset}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
