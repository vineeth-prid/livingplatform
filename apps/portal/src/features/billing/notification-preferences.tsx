import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type {
  CommunityNotificationTemplate, NotificationEventKey, NotificationPreference,
} from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, Dialog, DialogContent, Input, LoadingState, PageContainer, PageHeader,
  toast, useConfirm,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { TextAreaField } from '../shared/form-kit';

const EVENT_LABEL: Record<NotificationEventKey, string> = {
  MAINTENANCE_DUE: 'Maintenance due',
  PAYMENT_SUCCESS: 'Payment received',
  PAYMENT_CONFIRMATION: 'Payment confirmation',
  VISITOR_PASS: 'Visitor pass',
  VISITOR_APPROVED: 'Visitor approved',
  BOOKING_CONFIRMED: 'Booking confirmed',
  ANNOUNCEMENT: 'Announcement',
  TICKET_CREATED: 'Ticket created',
  TICKET_ASSIGNED: 'Ticket assigned',
  TICKET_UPDATE: 'Ticket updates',
  SERVICE_ASSIGNED: 'Service assigned',
  SERVICE_UPDATE: 'Service updates',
  WORK_ORDER_ASSIGNED: 'Work order assigned',
  WORK_ORDER_UPDATE: 'Work order updates',
  PASSWORD_RESET: 'Password reset',
  WELCOME: 'Welcome',
};

/**
 * Community Admin → notification preferences.
 *
 * One row per event, one toggle per channel. Rows the community has never
 * touched show the platform default and are marked as such, so an admin can
 * tell "we chose this" from "nobody has decided yet".
 */
export function NotificationPreferencesPage() {
  const { communityId, community } = useCommunity();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasPermission('notification:preference:update');
  const canTemplates = hasPermission('notification:template:manage');

  const prefs = useQuery({
    queryKey: ['notification-preferences', communityId],
    queryFn: () => living.notifications.preferences.list(communityId!),
    enabled: !!communityId,
  });
  const templates = useQuery({
    queryKey: ['notification-templates', communityId],
    queryFn: () => living.notifications.preferences.templates(communityId!),
    enabled: !!communityId,
  });

  const update = useMutation({
    mutationFn: ({
      event,
      input,
    }: {
      event: NotificationEventKey;
      input: Partial<Pick<NotificationPreference, 'enabled' | 'emailEnabled' | 'whatsappEnabled'>>;
    }) => living.notifications.preferences.update(communityId!, event, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences', communityId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const [editing, setEditing] = useState<{
    event: NotificationEventKey;
    channel: string;
    existing: CommunityNotificationTemplate | null;
  } | null>(null);

  if (prefs.isLoading || !prefs.data) return <LoadingState label="Loading notification preferences…" />;

  const templateFor = (event: NotificationEventKey, channel: string) =>
    (templates.data ?? []).find((t) => t.event === event && t.channel === channel) ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Notification preferences"
        description={`Which notifications ${community?.name ?? 'this community'} sends, on which channel, and in what words.`}
      />

      {/*
        A connected WhatsApp gateway does NOT mean WhatsApp notifications send.
        Routing is per community and per event, and both default to off — so an
        operator can configure the gateway, send a successful test message, and
        still see nothing delivered, with nothing on screen explaining why. This
        is that explanation.
      */}
      {prefs.data.every((p) => !p.whatsappEnabled) && (
        <Card variant="elevated" className="mb-4 flex items-start gap-3 border-warning/30">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
          <p className="text-sm text-muted">
            <strong className="text-strong">WhatsApp is off for every event.</strong> A connected
            gateway and a successful test message are not enough — each event below also has to be
            switched on here before anything is sent over WhatsApp.
          </p>
        </Card>
      )}

      <Card variant="elevated" className="p-0">
        <div className="w-full overflow-x-auto"><table className="w-full min-w-[640px]">
          <thead className="border-b border-border-subtle text-left">
            <tr className="text-xs uppercase tracking-wider text-subtle">
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </span>
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </span>
              </th>
              <th className="px-4 py-3 font-medium">Templates</th>
            </tr>
          </thead>
          <tbody>
            {prefs.data.map((p) => (
              <tr key={p.event} className="border-b border-border-subtle last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-strong">{EVENT_LABEL[p.event]}</span>
                    {!p.configured && (
                      <Badge tone="neutral" size="sm">
                        default
                      </Badge>
                    )}
                  </div>
                  {!p.enabled && (
                    <span className="text-xs text-danger-fg">Muted — nothing is sent</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={p.emailEnabled && p.enabled}
                    disabled={!canEdit || update.isPending}
                    label={`Email for ${EVENT_LABEL[p.event]}`}
                    onChange={(next) =>
                      update.mutate({ event: p.event, input: { emailEnabled: next, enabled: true } })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={p.whatsappEnabled && p.enabled}
                    disabled={!canEdit || update.isPending}
                    label={`WhatsApp for ${EVENT_LABEL[p.event]}`}
                    onChange={(next) =>
                      update.mutate({ event: p.event, input: { whatsappEnabled: next, enabled: true } })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(['email', 'whatsapp'] as const).map((channel) => {
                      const existing = templateFor(p.event, channel);
                      return (
                        <Button
                          key={channel}
                          size="sm"
                          variant={existing ? 'primary' : 'ghost'}
                          disabled={!canTemplates}
                          onClick={() => setEditing({ event: p.event, channel, existing })}
                        >
                          <Pencil className="h-3.5 w-3.5" /> {channel}
                        </Button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      <p className="mt-4 text-xs text-subtle">
        A blue template button means this community has its own wording. Otherwise the platform
        default is used.
      </p>

      {communityId && editing && (
        <TemplateDialog
          communityId={communityId}
          event={editing.event}
          channel={editing.channel}
          existing={editing.existing}
          onClose={() => setEditing(null)}
        />
      )}
    </PageContainer>
  );
}

/** A plain accessible switch — no new dependency for one control. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:shadow-ring disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-sunken'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-raised shadow-sm transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function TemplateDialog({
  communityId,
  event,
  channel,
  existing,
  onClose,
}: {
  communityId: string;
  event: NotificationEventKey;
  channel: string;
  existing: CommunityNotificationTemplate | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [body, setBody] = useState(existing?.body ?? '');

  const save = useMutation({
    mutationFn: () =>
      living.notifications.preferences.saveTemplate(communityId, {
        event,
        channel,
        subject: subject || undefined,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates', communityId] });
      toast.success('Template saved');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => living.notifications.preferences.deleteTemplate(communityId, existing!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates', communityId] });
      toast.success('Reverted to the platform default');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        open
        title={`${EVENT_LABEL[event]} · ${channel}`}
        description="Leave this blank to use the platform default wording."
      >
        {channel === 'email' && (
          <div className="mb-4">
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Maintenance due — {{invoiceNumber}}"
            />
          </div>
        )}
        <TextAreaField label="Message" value={body} onChange={setBody} rows={8} />
        <p className="mt-2 text-xs text-subtle">
          Handlebars variables are available, e.g.{' '}
          <code className="text-body">{'{{residentName}}'}</code>,{' '}
          <code className="text-body">{'{{amount}}'}</code>,{' '}
          <code className="text-body">{'{{dueDate}}'}</code>.
        </p>

        <div className="mt-5 flex justify-between gap-3">
          {existing ? (
            <Button
              variant="ghost"
              loading={remove.isPending}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Revert to the platform default?',
                    confirmLabel: 'Revert',
                    tone: 'danger',
                  }))
                )
                  return;
                remove.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" /> Use default
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!body.trim()} loading={save.isPending} onClick={() => save.mutate()}>
              Save template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
