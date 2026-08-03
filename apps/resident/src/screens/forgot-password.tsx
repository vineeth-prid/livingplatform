import { useState, type FormEvent } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Dialog, DialogContent, Input, toast } from '@living/ui';

import { living } from '../lib/living';

type Step = 'identify' | 'otp' | 'link-sent';

/**
 * Password recovery for a mobile-first platform.
 *
 * Residents log in with their mobile number, so recovery must work from that
 * number alone: the API sends a WhatsApp OTP and this sheet exchanges it for a
 * new password. Email accounts get the classic link, and the copy never reveals
 * which case applies until the server says so.
 */
export function ForgotPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      const result = await living.auth.forgotPassword(identifier);
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
      await living.auth.resetPasswordWithOtp(identifier, code, password);
      toast.success('Password changed — sign in with your new password');
      reset();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'That code is invalid or has expired');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && reset()}>
      <DialogContent
        open={open}
        title="Reset your password"
        description={
          step === 'identify'
            ? 'Enter your mobile number (or email) and we will send you a code.'
            : step === 'otp'
              ? `We sent a code to ${identifier}. Enter it below with your new password.`
              : undefined
        }
      >
        {step === 'identify' && (
          <form onSubmit={request} className="flex flex-col gap-4">
            <Input
              label="Mobile number or email"
              inputMode="text"
              autoComplete="username"
              placeholder="9876543210"
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
              Use a different number
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
