import { normalizeState, OpenWaClient } from './openwa.client';

const client = new OpenWaClient({
  baseUrl: 'http://openwa:3000',
  apiKey: 'k',
  session: 'living',
  timeoutMs: 1000,
  defaultCountryCode: '91',
});

describe('OpenWaClient.toChatId', () => {
  it('adds the default country code to a 10-digit local number', () => {
    expect(client.toChatId('9876543210')).toBe('919876543210@c.us');
  });

  it('keeps an already international number as-is', () => {
    expect(client.toChatId('+91 98765 43210')).toBe('919876543210@c.us');
  });

  it('strips formatting characters', () => {
    expect(client.toChatId('(987) 654-3210')).toBe('919876543210@c.us');
  });

  it('passes an existing chat id through untouched', () => {
    expect(client.toChatId('120363@g.us')).toBe('120363@g.us');
  });
});

describe('normalizeState', () => {
  it.each(['CONNECTED', 'authenticated', 'ready', 'open', 'WORKING'])(
    'maps %s to CONNECTED',
    (raw) => {
      expect(normalizeState(raw)).toBe('CONNECTED');
    },
  );

  it.each(['qr', 'SCAN_QR_CODE', 'pairing'])('maps %s to QR_PENDING', (raw) => {
    expect(normalizeState(raw)).toBe('QR_PENDING');
  });

  it.each(['starting', 'CONNECTING', 'initializing'])('maps %s to CONNECTING', (raw) => {
    expect(normalizeState(raw)).toBe('CONNECTING');
  });

  it.each(['failed', 'ERROR', 'conflict', 'banned'])('maps %s to FAILED', (raw) => {
    expect(normalizeState(raw)).toBe('FAILED');
  });

  it('falls back to DISCONNECTED for anything unrecognised', () => {
    expect(normalizeState(undefined)).toBe('DISCONNECTED');
    expect(normalizeState('something-new')).toBe('DISCONNECTED');
  });
});
