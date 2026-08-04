/**
 * The realtime event contract shared by the API and every client.
 *
 * Deliberately small and additive: a client that does not recognise a `type`
 * ignores it, so new event types never break a deployed app.
 */

export const RealtimeEventType = {
  /** A gate entry needs the resident's attention (popup + sound). */
  GateEntryArrived: 'gate.entry.arrived',
  /** The resident decided — echoed to the security desk in real time. */
  GateEntryDecided: 'gate.entry.decided',
  /** Any other status move (completed/cancelled) — refresh, no popup. */
  GateEntryUpdated: 'gate.entry.updated',
} as const;

export type RealtimeEventTypeName =
  (typeof RealtimeEventType)[keyof typeof RealtimeEventType];

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventTypeName;
  /** Server timestamp, ISO — clients use it to drop stale replays. */
  at: string;
  payload: T;
}

/**
 * Who a realtime event is addressed to. Exactly one of these is used per
 * publish; the hub turns it into channel name(s).
 *
 *  • `userIds`     — specific people (the resident whose delivery arrived)
 *  • `communityRoom` — everyone subscribed to a community room (the gate desk)
 */
export interface RealtimeAudience {
  userIds?: string[];
  communityRoom?: { communityId: string; room: string };
}

/** Rooms a client may subscribe to. Kept as a closed set so a client cannot
 *  ask to listen to something it has no permission for. */
export const RealtimeRoom = {
  /** The security desk view of gate activity for one community. */
  Gate: 'gate',
} as const;

export type RealtimeRoomName = (typeof RealtimeRoom)[keyof typeof RealtimeRoom];
