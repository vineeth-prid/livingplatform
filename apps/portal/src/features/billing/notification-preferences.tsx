import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type {
  CommunityNotificationTemplate, NotificationEventKey, NotificationPreference,
  NotificationTemplateDefaults,
} from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, Dialog, DialogContent, Input, LoadingState, PageContainer, PageHeader,
  toast, useConfirm,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';

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

  const defaults = useQuery({
    queryKey: ['notification-template-defaults', communityId],
    queryFn: () => living.notifications.preferences.templateDefaults(communityId!),
    enabled: !!communityId && canTemplates,
    staleTime: Infinity,
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
    channel: 'email' | 'whatsapp';
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
                {p.event === 'ANNOUNCEMENT' ? (
                  // Announcements never go out by email or WhatsApp — one message
                  // to the whole community would be too much. Only on/off here.
                  <>
                    <td className="px-4 py-3" colSpan={2}>
                      <div className="flex items-center gap-3">
                        <Toggle
                          checked={p.enabled}
                          disabled={!canEdit || update.isPending}
                          label="In-app banner and push for announcements"
                          onChange={(next) => update.mutate({ event: p.event, input: { enabled: next } })}
                        />
                        <span className="text-xs text-subtle">In-app banner + push to every resident</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-subtle">Uses the announcement itself</td>
                  </>
                ) : (
                <>
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
                </>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      <p className="mt-4 text-xs text-subtle">
        A filled template button means this community uses its own wording; otherwise the
        platform default is sent. Messages are signed with your community’s name when it has its
        own branding.
      </p>

      {communityId && editing && (
        <TemplateDialog
          communityId={communityId}
          event={editing.event}
          channel={editing.channel}
          existing={editing.existing}
          defaults={defaults.data?.find((d) => d.event === editing.event)}
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


/** WhatsApp's own *bold* markup, shown as it will appear on the phone. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        /^\*[^*\n]+\*$/.test(part) ? <strong key={i}>{part.slice(1, -1)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

/**
 * Edit one event's wording on one channel, beside a live preview rendered by
 * the SAME server-side engine that sends it — with this community's real
 * branding and sample values — so what the admin sees is what residents get.
 * The server refuses placeholders the event never supplies.
 */
function TemplateDialog({
  communityId,
  event,
  channel,
  existing,
  defaults,
  onClose,
}: {
  communityId: string;
  event: NotificationEventKey;
  channel: 'email' | 'whatsapp';
  existing: CommunityNotificationTemplate | null;
  defaults: NotificationTemplateDefaults | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fallback = defaults?.[channel];
  const isEmail = channel === 'email';
  const initialBody = existing?.body ?? fallback?.body ?? '';
  const initialSubject = existing?.subject ?? fallback?.subject ?? '';
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = body !== initialBody || (isEmail && subject !== initialSubject);

  // Debounced so typing doesn't fire a render per keystroke.
  const [draft, setDraft] = useState({ body, subject });
  useEffect(() => {
    const t = setTimeout(() => setDraft({ body, subject }), 350);
    return () => clearTimeout(t);
  }, [body, subject]);
  const preview = useQuery({
    queryKey: ['notification-template-preview', communityId, event, channel, draft],
    queryFn: () =>
      living.notifications.preferences.previewTemplate(communityId, {
        event,
        channel,
        body: draft.body,
        subject: isEmail ? draft.subject || undefined : undefined,
      }),
    enabled: !!draft.body.trim(),
    placeholderData: (prev) => prev,
  });

  const insert = (name: string) => {
    const el = area.current;
    const token = `{{${name}}}`;
    const at = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? at;
    setBody(body.slice(0, at) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const save = useMutation({
    mutationFn: () =>
      living.notifications.preferences.saveTemplate(communityId, {
        event,
        channel,
        subject: isEmail ? subject || undefined : undefined,
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

  const error = preview.data && !preview.data.ok ? preview.data.error : null;
  const atDefault = !fallback || (body === fallback.body && (!isEmail || subject === fallback.subject));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        open
        className="max-w-[1040px]"
        title={`${EVENT_LABEL[event]} · ${isEmail ? 'Email' : 'WhatsApp'}`}
        description={
          existing
            ? 'This community uses its own wording for this message.'
            : 'Showing the platform default. Edit it to use your own wording.'
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            {isEmail && (
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-strong">Message</span>
              <textarea
                ref={area}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={isEmail ? 14 : 16}
                spellCheck={!isEmail}
                className="rounded-control border border-border bg-raised px-3 py-2 text-sm leading-relaxed text-strong outline-none transition-shadow focus-visible:shadow-ring"
              />
            </label>

            <div>
              <p className="text-sm font-medium text-strong">Insert a variable</p>
              <p className="mt-0.5 text-xs text-subtle">
                Filled in when the message is sent. <span className="text-danger-fg">•</span> marks
                values the message cannot be sent without.
                {isEmail && ' Write plain text: a "Label: value" list becomes a table and a line like "Pay now: {{payment_link}}" becomes a button.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(defaults?.variables ?? []).map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    title={`{{${v.name}}}`}
                    onClick={() => insert(v.name)}
                    className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-sunken px-2.5 py-1 text-xs text-body transition-colors hover:border-border hover:text-strong focus-visible:shadow-ring"
                  >
                    {v.required && <span className="text-danger-fg">•</span>}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger-fg">
                {error}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-strong">Preview</p>
            {isEmail ? (
              <div className="overflow-hidden rounded-card border border-border-subtle bg-white">
                <p className="truncate border-b border-border-subtle px-3 py-2 text-xs text-muted">
                  <span className="text-subtle">Subject:</span>{' '}
                  <span className="font-medium text-strong">{preview.data?.subject ?? ''}</span>
                </p>
                <iframe title="Email preview" sandbox="" srcDoc={preview.data?.html ?? ''} className="h-[460px] w-full" />
              </div>
            ) : (
              <div className="rounded-card bg-[#e9e2d6] p-3">
                <div className="ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-sm">
                  {preview.data?.ok ? (
                    <WhatsAppText text={preview.data.text} />
                  ) : (
                    <span className="text-[#667781]">Nothing to preview yet.</span>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-subtle">Sample values, with your community&rsquo;s own name and branding.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={atDefault}
              onClick={() => {
                setBody(fallback?.body ?? '');
                setSubject(fallback?.subject ?? '');
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset to default
            </Button>
            {existing && (
              <Button
                variant="ghost"
                loading={remove.isPending}
                onClick={async () => {
                  if (
                    !(await confirm({
                      title: 'Use the platform default?',
                      description: 'Your custom wording for this message will be removed.',
                      confirmLabel: 'Use default',
                      tone: 'danger',
                    }))
                  )
                    return;
                  remove.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" /> Remove custom wording
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!body.trim() || !dirty || !!error || preview.isFetching}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
