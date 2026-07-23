import type { ConfigService } from '@nestjs/config';

import { WhatsAppChannel } from './whatsapp.channel';
import { WhatsAppProviderFactory } from './whatsapp-provider.factory';
import type { WhatsAppProvider } from './whatsapp-provider.interface';

function channelWith(provider: Partial<WhatsAppProvider>): WhatsAppChannel {
  const full: WhatsAppProvider = {
    name: 'meta',
    sendText: jest.fn().mockResolvedValue({ messageId: 'wamid.1', provider: 'meta' }),
    sendTemplate: jest.fn().mockResolvedValue({ messageId: 'wamid.t', provider: 'meta' }),
    sendMedia: jest.fn().mockResolvedValue({ messageId: 'wamid.m', provider: 'meta' }),
    sendInteractive: jest.fn().mockResolvedValue({ messageId: 'wamid.i', provider: 'meta' }),
    sendLocation: jest.fn().mockResolvedValue({ messageId: 'wamid.l', provider: 'meta' }),
    sendContacts: jest.fn().mockResolvedValue({ messageId: 'wamid.c', provider: 'meta' }),
    uploadMedia: jest.fn().mockResolvedValue('media-1'),
    markRead: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn().mockResolvedValue(true),
    health: jest.fn().mockResolvedValue({ state: 'healthy', provider: 'meta' }),
    close: jest.fn().mockResolvedValue(undefined),
    ...provider,
  };
  jest.spyOn(WhatsAppProviderFactory, 'create').mockReturnValue(full);
  return new WhatsAppChannel({} as unknown as ConfigService<Record<string, unknown>, true>);
}

describe('WhatsAppChannel', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is the whatsapp channel', () => {
    const ch = channelWith({});
    expect(ch.channel).toBe('whatsapp');
    expect(ch.provider).toBe('meta');
  });

  it('sends a text message by default', async () => {
    const sendText = jest.fn().mockResolvedValue({ messageId: 'wamid.1', provider: 'meta' });
    const ch = channelWith({ sendText });
    const r = await ch.send({ channel: 'whatsapp', to: '+919876543210', text: 'Hello' });
    expect(sendText).toHaveBeenCalledWith('+919876543210', 'Hello', false);
    expect(r).toMatchObject({ messageId: 'wamid.1', channel: 'whatsapp', provider: 'meta' });
  });

  it('routes template / media / interactive by channelData.kind', async () => {
    const sendTemplate = jest.fn().mockResolvedValue({ messageId: 't', provider: 'meta' });
    const sendMedia = jest.fn().mockResolvedValue({ messageId: 'm', provider: 'meta' });
    const sendInteractive = jest.fn().mockResolvedValue({ messageId: 'i', provider: 'meta' });
    const ch = channelWith({ sendTemplate, sendMedia, sendInteractive });
    await ch.send({ channel: 'whatsapp', to: '+911', text: '', channelData: { kind: 'template', template: { name: 'hello', language: 'en_US' } } });
    await ch.send({ channel: 'whatsapp', to: '+911', text: '', channelData: { kind: 'media', media: { type: 'image', link: 'https://x/y.png' } } });
    await ch.send({ channel: 'whatsapp', to: '+911', text: '', channelData: { kind: 'interactive', interactive: { type: 'button' } } });
    expect(sendTemplate).toHaveBeenCalled();
    expect(sendMedia).toHaveBeenCalled();
    expect(sendInteractive).toHaveBeenCalled();
  });

  it('sends one message per recipient (multiple recipients)', async () => {
    const sendText = jest.fn().mockResolvedValue({ messageId: 'x', provider: 'meta' });
    const ch = channelWith({ sendText });
    await ch.send({ channel: 'whatsapp', to: ['+911', '+922'], text: 'Hi' });
    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it('advertises WhatsApp features via supports()', () => {
    const ch = channelWith({});
    expect(ch.supports('interactive')).toBe(true);
    expect(ch.supports('read-receipts')).toBe(true);
    expect(ch.supports('nonexistent')).toBe(false);
  });
});
