import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

/**
 * The reason this exists. The stock tracker reads the leftmost X-Forwarded-For
 * entry, which is whatever the CLIENT sent — so a caller that varies that
 * header gets a fresh rate-limit bucket per request and login's 5-per-minute
 * budget stops meaning anything. `req.ip` is computed by Express from the
 * socket inwards, discarding exactly TRUST_PROXY hops, so a forged prefix
 * cannot move it.
 */
describe('ClientIpThrottlerGuard', () => {
  // getTracker is protected; the cast is the point of the test.
  const track = (req: Record<string, unknown>) =>
    (new ClientIpThrottlerGuard(
      undefined as never,
      undefined as never,
      undefined as never,
    ) as unknown as { getTracker(r: Record<string, unknown>): Promise<string> }).getTracker(req);

  it('tracks req.ip, not the spoofable head of the forwarded chain', async () => {
    const req = { ip: '198.51.100.7', ips: ['203.0.113.9', '198.51.100.7'] };
    await expect(track(req)).resolves.toBe('198.51.100.7');
  });

  it('gives a client the same bucket however it forges X-Forwarded-For', async () => {
    const forged = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((spoof) =>
      track({ ip: '198.51.100.7', ips: [spoof, '198.51.100.7'] }),
    );
    await expect(Promise.all(forged)).resolves.toEqual([
      '198.51.100.7',
      '198.51.100.7',
      '198.51.100.7',
    ]);
  });

  it('falls back to a constant rather than undefined when there is no address', async () => {
    // An undefined key would collapse every anonymous caller into one bucket
    // silently; 'unknown' does the same thing but is greppable in the logs.
    await expect(track({})).resolves.toBe('unknown');
  });
});
