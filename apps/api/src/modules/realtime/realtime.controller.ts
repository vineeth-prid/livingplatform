import { Controller, ForbiddenException, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { merge, interval, map, type Observable } from 'rxjs';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { RealtimeService } from './realtime.service';
import { RealtimeRoom } from './realtime.types';

/** A framed SSE message. Nest serialises `data` and writes the `event:` line. */
interface SseMessage {
  data: string;
  type?: string;
}

/** Rooms a caller may join, and the permission each one demands. */
const ROOM_PERMISSION: Record<string, string> = {
  [RealtimeRoom.Gate]: PERMISSIONS.GATE_ENTRY_VIEW,
};

/** Keep-alive cadence. Proxies and mobile networks drop idle streams; a comment
 *  frame every 25s is the conventional way to hold one open. */
const HEARTBEAT_MS = 25_000;

@ApiTags('Realtime')
@ApiBearerAuth()
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * The single realtime stream. Every caller gets their own private user
   * channel; `rooms` additionally joins community rooms they hold permission
   * for. Authentication is the ordinary global JWT guard — this is plain HTTP,
   * so nothing about auth changes. Browsers must open it with `fetch` (to send
   * the bearer header) rather than `EventSource`.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'Server-sent event stream (user channel + optional rooms)' })
  @ApiQuery({ name: 'communityId', required: false })
  @ApiQuery({
    name: 'rooms',
    required: false,
    description: 'Comma-separated room names, e.g. "gate". Requires the room permission.',
  })
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Query('communityId') communityId?: string,
    @Query('rooms') rooms?: string,
  ): Observable<SseMessage> {
    const channels = [this.realtime.userChannel(user.id)];

    for (const room of (rooms ?? '').split(',').map((r) => r.trim()).filter(Boolean)) {
      const required = ROOM_PERMISSION[room];
      if (!required) throw new ForbiddenException(`Unknown realtime room "${room}"`);
      if (!communityId) {
        throw new ForbiddenException(`Room "${room}" requires a communityId`);
      }
      if (!user.permissions.includes(required)) {
        throw new ForbiddenException(`Missing "${required}" for realtime room "${room}"`);
      }
      channels.push(this.realtime.roomChannel(communityId, room));
    }

    const events = this.realtime
      .streamFor(channels)
      .pipe(map((event): SseMessage => ({ type: event.type, data: JSON.stringify(event) })));

    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): SseMessage => ({ type: 'ping', data: JSON.stringify({ at: new Date().toISOString() }) })),
    );

    return merge(events, heartbeat);
  }
}
