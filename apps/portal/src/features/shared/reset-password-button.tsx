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
}: {
  userId: string | null | undefined;
  personName: string;
}) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [temporary, setTemporary] = useState<string | null>(null);

  if (!userId || !hasPermission('user:update')) return null;

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

      <Dialog open={!!temporary} onOpenChange={(next) => !next && setTemporary(null)}>
        <DialogContent
          open={!!temporary}
          title="Password reset"
          description={`Share this temporary password with ${personName}. They must change it at next sign-in.`}
        >
          <p className="rounded-control bg-sunken px-4 py-3 text-center font-mono text-lg text-strong">
            {temporary}
          </p>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => setTemporary(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
