import { firstValueFrom, take, toArray } from 'rxjs';

import { RealtimeService } from './realtime.service';
import { RealtimeEventType, RealtimeRoom } from './realtime.types';

function makeHub(): RealtimeService {
  const config = {
    get: () => ({ url: 'redis://localhost:6379' }),
  } as unknown as ConstructorParameters<typeof RealtimeService>[0];
  // Never initialised, so no Redis connection is ever opened — the local bus is
  // what every connected client actually reads from.
  return new RealtimeService(config);
}

describe('RealtimeService', () => {
  it('delivers an event to the addressed user and nobody else', async () => {
    const hub = makeHub();
    const mine = firstValueFrom(hub.streamFor([hub.userChannel('u-1')]).pipe(take(1)));
    const theirs: unknown[] = [];
    hub.streamFor([hub.userChannel('u-2')]).subscribe((e) => theirs.push(e));

    hub.publish(RealtimeEventType.GateEntryArrived, { userIds: ['u-1'] }, { entryId: 'ge-1' });

    await expect(mine).resolves.toMatchObject({
      type: RealtimeEventType.GateEntryArrived,
      payload: { entryId: 'ge-1' },
    });
    expect(theirs).toHaveLength(0);
  });

  it('delivers a room event to every subscriber of that community room', async () => {
    const hub = makeHub();
    const room = hub.roomChannel('c-1', RealtimeRoom.Gate);
    const guardA = firstValueFrom(hub.streamFor([room]).pipe(take(1)));
    const guardB = firstValueFrom(hub.streamFor([room]).pipe(take(1)));
    const otherCommunity: unknown[] = [];
    hub
      .streamFor([hub.roomChannel('c-2', RealtimeRoom.Gate)])
      .subscribe((e) => otherCommunity.push(e));

    hub.publish(
      RealtimeEventType.GateEntryDecided,
      { communityRoom: { communityId: 'c-1', room: RealtimeRoom.Gate } },
      { status: 'APPROVED' },
    );

    await expect(guardA).resolves.toMatchObject({ payload: { status: 'APPROVED' } });
    await expect(guardB).resolves.toMatchObject({ payload: { status: 'APPROVED' } });
    // Tenant isolation at the transport layer, not just in the query.
    expect(otherCommunity).toHaveLength(0);
  });

  it('delivers once to a client subscribed to several matching channels', async () => {
    const hub = makeHub();
    const room = hub.roomChannel('c-1', RealtimeRoom.Gate);
    const received = firstValueFrom(
      hub.streamFor([hub.userChannel('u-1'), room]).pipe(take(1), toArray()),
    );

    // Addressed to BOTH of this client's channels — it must not double-fire.
    hub.publish(
      RealtimeEventType.GateEntryUpdated,
      { userIds: ['u-1'], communityRoom: { communityId: 'c-1', room: RealtimeRoom.Gate } },
      { entryId: 'ge-9' },
    );

    await expect(received).resolves.toHaveLength(1);
  });

  it('is a no-op when nobody is addressed', () => {
    const hub = makeHub();
    const seen: unknown[] = [];
    hub.streamFor([hub.userChannel('u-1')]).subscribe((e) => seen.push(e));

    hub.publish(RealtimeEventType.GateEntryArrived, {}, { entryId: 'ge-1' });

    expect(seen).toHaveLength(0);
  });

  it('never throws when publishing with no Redis connection', () => {
    const hub = makeHub();
    expect(() =>
      hub.publish(RealtimeEventType.GateEntryArrived, { userIds: ['u-1'] }, {}),
    ).not.toThrow();
  });
});
