import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Check, Package, PhoneCall, ShieldCheck, X } from 'lucide-react';
import { LivingApiError, type GateEntry, type RealtimeEvent } from '@living/living-sdk';
import { useCommunityFeatures, useRealtime } from '@living/hooks';
import { Badge, Button, Dialog, DialogContent, toast } from '@living/ui';

import { useResidentCommunity } from '../community';
import { living } from '../lib/living';
import { alertGateArrival, unlockAudio } from './alert-sound';

/**
 * The gate arrival popup.
 *
 * Mounted once in the shell so a delivery interrupts the resident wherever they
 * are in the app. Three things have to line up:
 *
 *  1. The realtime stream delivers the arrival while the app is open.
 *  2. A poll-on-mount catches anything that arrived while it was closed (or
 *     while the stream was down) — the ENTRY is the source of truth, never the
 *     notification, so a missed message can never lose a delivery.
 *  3. Push covers the app being closed entirely; tapping it deep-links here.
 */
export function GateAlerts() {
  const { communityId } = useResidentCommunity();
  const features = useCommunityFeatures(communityId);
  const qc = useQueryClient();
  const [active, setActive] = useState<GateEntry | null>(null);

  // Read from the resident-readable features endpoint, not the settings
  // document — residents hold no `settings:read`.
  const soundEnabled = features.gateSound;
  const enabled = !!communityId && features.gateManagement;

  // Anything already waiting for me. Also the reconnect safety net: if the
  // stream drops, this still surfaces the delivery within a minute.
  const pending = useQuery({
    queryKey: ['gate', 'mine', 'pending'],
    queryFn: () => living.gate.mine({ pendingOnly: true, limit: 5, sortBy: 'createdAt', sortDir: 'desc' }),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Autoplay policy: the first tap anywhere unlocks audio for later alerts.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const raise = useCallback(
    (entry: GateEntry) => {
      setActive((current) => {
        // Never replace a popup the resident is already deciding on.
        if (current) return current;
        alertGateArrival({ sound: soundEnabled });
        void living.gate.markViewed(entry.id).catch(() => undefined);
        return entry;
      });
    },
    [soundEnabled],
  );

  useRealtime({
    enabled,
    onEvent: (event: RealtimeEvent) => {
      if (event.type !== 'gate.entry.arrived') return;
      const payload = event.payload as { entryId?: string };
      if (!payload?.entryId) return;
      void qc.invalidateQueries({ queryKey: ['gate'] });
      // Fetch the real entry rather than trusting the message payload — one
      // shape to render, and it is guaranteed current.
      living.gate
        .get(payload.entryId)
        .then((entry) => {
          if (entry.status === 'CREATED' || entry.status === 'NOTIFIED') raise(entry);
        })
        .catch(() => undefined);
    },
  });

  // Surface whatever the poll found, if nothing is on screen already.
  useEffect(() => {
    const first = pending.data?.items?.[0];
    if (first && !active) raise(first);
  }, [pending.data, active, raise]);

  return (
    <GateDecisionDialog
      entry={active}
      onClose={() => {
        setActive(null);
        void qc.invalidateQueries({ queryKey: ['gate'] });
      }}
    />
  );
}

const TYPE_ICON: Record<string, typeof Package> = {
  FOOD: Bike,
  COURIER: Package,
  GROCERY: Package,
  MEDICINE: Package,
};

/** The Approve / Reject modal. Also used by the delivery detail screen. */
export function GateDecisionDialog({
  entry,
  onClose,
}: {
  entry: GateEntry | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? living.gate.approve(id) : living.gate.reject(id),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['gate'] });
      toast.success(variables.approve ? 'Approved — security notified' : 'Rejected — security notified');
      onClose();
    },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Could not send your decision'),
    onSettled: () => setBusy(null),
  });

  if (!entry) return null;
  const Icon = TYPE_ICON[entry.deliveryType ?? ''] ?? Package;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        open
        showClose={false}
        title={`Delivery at ${entry.gate?.name ?? 'Main Gate'}`}
        description="Your delivery has arrived at the gate."
        className="max-w-md"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-tint text-brand">
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-h4 leading-tight tracking-tight text-strong">
              {entry.vendorName ?? 'Delivery'}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {entry.personName}
              {entry.mobileNumber ? ` · ${entry.mobileNumber}` : ''}
            </p>
          </div>
          {entry.unit && (
            <Badge tone="neutral" size="sm">{entry.unit.unitNumber}</Badge>
          )}
        </div>

        {entry.photoUrl && (
          <img
            src={entry.photoUrl}
            alt="Taken at the gate"
            className="mb-4 max-h-48 w-full rounded-control object-cover"
          />
        )}

        <dl className="mb-5 flex flex-col gap-1.5 text-sm">
          <Row label="Time" value={new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
          {entry.remarks && <Row label="Note" value={entry.remarks} />}
          <Row label="Reference" value={entry.entryNumber} mono />
        </dl>

        <div className="flex gap-3">
          <Button
            block
            size="lg"
            loading={busy === 'approve'}
            disabled={decide.isPending}
            onClick={() => { setBusy('approve'); decide.mutate({ id: entry.id, approve: true }); }}
          >
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            block
            size="lg"
            variant="secondary"
            loading={busy === 'reject'}
            disabled={decide.isPending}
            onClick={() => { setBusy('reject'); decide.mutate({ id: entry.id, approve: false }); }}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>

        {/* Specified as future scope — shown disabled so the affordance exists
            and residents are not surprised when it lights up later. */}
        <div className="mt-3 flex gap-3">
          <Button block variant="ghost" size="sm" disabled>
            <ShieldCheck className="h-4 w-4" /> Call security
          </Button>
          <Button block variant="ghost" size="sm" disabled>
            <PhoneCall className="h-4 w-4" /> Call delivery
          </Button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-subtle underline-offset-2 hover:underline"
        >
          Decide later — security will hold it at the gate
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className={`text-body ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
