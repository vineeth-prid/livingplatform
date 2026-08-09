import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, Dialog, DialogContent, toast, useConfirm } from '@living/ui';

import { living } from '../../lib/living';

/**
 * Admin password reset for a person's login account.
 *
 * Deliberately shows the temporary password once, in a dialog, so the admin can
 * read it out — it is the platform's documented one-time password and the user
 * is forced to change it at next sign-in anyway. Every active session for that
 * user is revoked server-side the moment this runs.
 */
export function ResetPasswordButton({
  userId,
  personName,
  provisionLogin,
  onProvisioned,
}: {
  userId: string | null | undefined;
  personName: string;
  /** Creates the missing login. Omit for people who cannot be provisioned one. */
  provisionLogin?: () => Promise<{ temporaryPassword: string }>;
  onProvisioned?: () => void;
}) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [temporary, setTemporary] = useState<string | null>(null);

  async function onCreateLogin() {
    if (!provisionLogin) return;
    setBusy(true);
    try {
      const result = await provisionLogin();
      setTemporary(result.temporaryPassword);
      onProvisioned?.();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not create the login');
    } finally {
      setBusy(false);
    }
  }

  // No permission → the control genuinely does not belong to this admin.
  if (!hasPermission('user:update')) return null;

  // No linked login. Explaining that was still a dead end — the admin knew what
  // was wrong and had no way to fix it, so "reset password does not work" was a
  // fair description. Offer the action that resolves it instead: provision the
  // account this person never got.
  //
  // It happens when the phone was already registered at the time the profile
  // was created; provisioning links an account to the FIRST profile on a number
  // and leaves later ones unlinked.
  if (!userId) {
    if (!provisionLogin) {
      return (
        <Button
          variant="ghost"
          disabled
          aria-label="No login account linked"
          title={`${personName} has no login account, so there is no password to reset.`}
        >
          <KeyRound className="h-4 w-4 opacity-40" />
        </Button>
      );
    }
    return (
      <>
        <Button variant="secondary" size="sm" loading={busy} onClick={onCreateLogin}>
          <KeyRound className="h-4 w-4" /> Create login
        </Button>
        <CredentialDialog
          value={temporary}
          personName={personName}
          onClose={() => setTemporary(null)}
        />
      </>
    );
  }

  async function onReset() {
    const ok = await confirm({
      title: `Reset the password for ${personName}?`,
      description:
        'They will be signed out everywhere and must set a new password the next time they sign in.',
      confirmLabel: 'Reset password',
      tone: 'danger',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const result = await living.auth.adminResetPassword(userId!);
      setTemporary(result.temporaryPassword);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" loading={busy} onClick={onReset} aria-label="Reset password">
        <KeyRound className="h-4 w-4" />
      </Button>

      <CredentialDialog value={temporary} personName={personName} onClose={() => setTemporary(null)} />
    </>
  );
}

/** The one-time password, shown once. Shared by reset and first provisioning. */
function CredentialDialog({
  value, personName, onClose,
}: {
  value: string | null;
  personName: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        open={!!value}
        title="Temporary password"
        description={`Share this with ${personName}. They sign in with their mobile number and must change it immediately.`}
      >
        <p className="rounded-control bg-sunken px-4 py-3 text-center font-mono text-lg text-strong">
          {value}
        </p>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
