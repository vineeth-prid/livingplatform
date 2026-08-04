import { describe, expect, it } from 'vitest';

import { urlBase64ToUint8Array } from './use-push';

/**
 * VAPID keys are base64url with the padding stripped. `PushManager.subscribe`
 * rejects a malformed key with a generic "InvalidAccessError", which is
 * miserable to debug at 3am — so the padding maths gets its own test.
 */
describe('urlBase64ToUint8Array', () => {
  it('decodes an unpadded base64url key', () => {
    // "Man" → "TWFu" needs no padding.
    expect(Array.from(urlBase64ToUint8Array('TWFu'))).toEqual([0x4d, 0x61, 0x6e]);
  });

  it('restores stripped padding', () => {
    // "Ma" → "TWE=" (1 pad), "M" → "TQ==" (2 pads); VAPID keys ship unpadded.
    expect(Array.from(urlBase64ToUint8Array('TWE'))).toEqual([0x4d, 0x61]);
    expect(Array.from(urlBase64ToUint8Array('TQ'))).toEqual([0x4d]);
  });

  it('maps the base64url alphabet back to standard base64', () => {
    // 0xFB 0xFF encodes as "+/8" in base64 and "-_8" in base64url. Getting this
    // wrong silently produces a valid-length key that the push service rejects.
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff]);
  });

  it('produces the 65 bytes a real VAPID application server key must be', () => {
    // A P-256 uncompressed public point: 0x04 followed by two 32-byte coords.
    const raw = new Uint8Array(65).fill(7);
    raw[0] = 0x04;
    const base64Url = btoa(String.fromCharCode(...raw))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const decoded = urlBase64ToUint8Array(base64Url);

    expect(decoded).toHaveLength(65);
    expect(decoded[0]).toBe(0x04);
    expect(Array.from(decoded)).toEqual(Array.from(raw));
  });

  it('returns a plain ArrayBuffer-backed view (BufferSource for subscribe)', () => {
    const decoded = urlBase64ToUint8Array('TWFu');
    expect(decoded.buffer).toBeInstanceOf(ArrayBuffer);
  });
});
