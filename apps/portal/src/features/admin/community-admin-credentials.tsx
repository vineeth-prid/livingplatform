import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';
import {
  Badge, Button, Dialog, DialogContent, EmptyState, LoadingState, toast, useConfirm,
} from '@living/ui';
import { Copy, KeyRound, Mail } from 'lucide-react';

import { living } from '../../lib/living';

/**
 * The operator's view of a community's Association Admin login.
 *
 * The ask was "display and change the password". Half of that is impossible and
 * saying so is the feature: passwords are argon2 hashes, so nothing — not this
 * dialog, not the database, not us — can read one back. What an operator
 * actually needs is to get a working credential into the admin's hands, so this
 * shows WHO the account is and resets it to a fresh one-time password on
 * demand, displayed once.
 */
export function CommunityAdminCredentials({
  communityId,
  communityName,
  open,
  onOpenChange,
}: {
  communityId: string;
  communityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [temporary, setTemporary] = useState<string | null>(null);
  /** Set when the reset also emailed the password, so the dialog can say so. */
  const [emailedTo, setEmailedTo] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ['admin', 'community-admin', communityId],
    queryFn: () => living.platform.communityAdmin(communityId),
    enabled: open,
    retry: false,
  });

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
  };

  /**
   * `sendEmail` decides whether the new password is also emailed to the admin.
   *
   * Both paths still show it here, because email can be slow, wrong or bounce
   * and this dialog is the only other place it will ever exist.
   */
  async function onReset(email: string, sendEmail: boolean) {
    const ok = await confirm({
      title: `Reset the password for ${communityName}'s admin?`,
      description:
        `${email} will be signed out everywhere and must set a new password at next sign-in. ` +
        (sendEmail
          ? `The temporary password will be emailed to ${email}, and shown here once as well.`
          : 'The temporary password is shown once — copy it before closing.'),
      confirmLabel: sendEmail ? 'Reset and email' : 'Reset password',
      tone: 'danger',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const result = await living.platform.resetCommunityAdminPassword(communityId, sendEmail);
      setTemporary(result.temporaryPassword);
      setEmailedTo(result.emailedTo);
      if (result.emailedTo) toast.success(`Password reset and emailed to ${result.emailedTo}`);
      else toast.success('Password reset');
      void account.refetch();
    } catch (err) {
      // A failure here may mean the password WAS reset but the email did not go
      // out, so say so rather than implying nothing happened.
      toast.error(
        err instanceof LivingApiError
          ? `${err.message} — if the reset went through, use "Reset without email" and copy the password.`
          : 'Could not reset the password',
      );
    } finally {
      setBusy(false);
    }
  }

  const close = (next: boolean) => {
    if (!next) { setTemporary(null); setEmailedTo(null); }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        open={open}
        title="Association admin login"
        description={`The account that administers ${communityName}.`}
      >
        {account.isLoading ? (
          <LoadingState label="Loading the admin account…" />
        ) : account.isError ? (
          <EmptyState
            icon={KeyRound}
            title="No association admin"
            description={
              account.error instanceof LivingApiError
                ? account.error.message
                : 'This community has no association admin account.'
            }
          />
        ) : account.data ? (
          <div className="flex flex-col gap-4">
            <Field label="Name" value={`${account.data.firstName} ${account.data.lastName}`} />
            <Field label="Email (username)" value={account.data.email} onCopy={copy} mono />

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={account.data.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" dot>
                {account.data.status.toLowerCase()}
              </Badge>
              {account.data.mustChangePassword && (
                <Badge tone="warning" size="sm">must change password</Badge>
              )}
              <span className="text-xs text-subtle">
                {account.data.lastLoginAt
                  ? `Last signed in ${new Date(account.data.lastLoginAt).toLocaleDateString()}`
                  : 'Has never signed in'}
              </span>
            </div>

            {temporary ? (
              <div className="flex flex-col gap-2 rounded-control border border-brand/30 bg-sunken p-4">
                <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                  New temporary password
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-lg text-strong">{temporary}</code>
                  <Button variant="ghost" size="sm" onClick={() => copy(temporary)} aria-label="Copy password">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-subtle">
                  {emailedTo
                    ? `Emailed to ${emailedTo}. Also shown once here — copy it if you would rather hand it over directly.`
                    : 'Shown once. Copy it now — closing this dialog is the last you will see of it.'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-subtle">
                The current password cannot be displayed: it is stored as a one-way hash, so no
                one — including the platform operator — can read it back. Reset it to issue a new
                one.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>Close</Button>
              {/* Reset-without-email stays available: the stored address may be
                  wrong or unreachable, and in that case emailing the credential
                  achieves nothing while still invalidating the old password. */}
              <Button variant="ghost" loading={busy} onClick={() => onReset(account.data.email, false)}>
                Reset without email
              </Button>
              <Button loading={busy} onClick={() => onReset(account.data.email, true)}>
                <Mail className="h-4 w-4" />
                {temporary ? 'Reset and email again' : 'Reset and email to admin'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onCopy, mono,
}: {
  label: string;
  value: string;
  onCopy?: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <div className="flex items-center gap-2">
        <code className={`flex-1 truncate rounded-control bg-sunken px-2.5 py-1.5 text-sm text-strong ${mono ? 'font-mono' : ''}`}>
          {value}
        </code>
        {onCopy && (
          <Button variant="ghost" size="sm" onClick={() => onCopy(value)} aria-label={`Copy ${label}`}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
