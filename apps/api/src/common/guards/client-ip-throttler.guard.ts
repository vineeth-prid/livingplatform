import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting keyed on an address the caller cannot choose.
 *
 * The stock guard tracks `req.ips[0]` — the LEFTMOST `X-Forwarded-For` entry.
 * Every proxy appends to the right of that header, so the leftmost value is
 * whatever the original client sent, and a client that prepends its own entry
 * picks its own bucket:
 *
 *     X-Forwarded-For: 203.0.113.9      →  tracked as 203.0.113.9
 *     X-Forwarded-For: <random each request>  →  never rate limited at all
 *
 * `req.ip` is derived instead by walking in from the socket and discarding
 * exactly TRUST_PROXY hops, so it lands on the address our own proxy observed.
 * A forged prefix stays to the left of that point and is ignored.
 *
 * This matters most on the endpoints with the tightest budgets — login is five
 * attempts a minute — which are precisely the ones worth brute-forcing.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return (req.ip as string) ?? 'unknown';
  }
}
