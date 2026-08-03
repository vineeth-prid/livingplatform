import { useState, type FormEvent } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Dialog, DialogContent, Input, toast } from '@living/ui';

import { living } from '../lib/living';

type Step = 'identify' | 'otp' | 'link-sent';

/**
 * Password recovery for the portal. Same two paths as the API exposes: an
 * emailed link for email accounts, a WhatsApp OTP for the mobile-number logins
 * that staff, vendors and residents use.
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
            ? 'Enter the email or mobile number you sign in with.'
            : step === 'otp'
              ? `We sent a code to ${identifier}.`
              : undefined
        }
      >
        {step === 'identify' && (
          <form onSubmit={request} className="flex flex-col gap-4">
            <Input
              label="Email or mobile"
              autoComplete="username"
              placeholder="you@community.com or 9876543210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <Button type="submit" block loading={busy}>
              Send reset instructions
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
            <Button type="submit" block loading={busy}>
              Set new password
            </Button>
          </form>
        )}

        {step === 'link-sent' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-body">
              If that account exists, a reset link is on its way.
            </p>
            <Button block onClick={reset}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
