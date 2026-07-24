import { Readable } from 'node:stream';

import { BadRequestException } from '@nestjs/common';

import { NotificationDispatcher } from './notification.dispatcher';
import type { ChannelRouter } from './channel-router';
import type { DeliveryTracker } from './delivery-tracker';
import type { SenderResolver } from './sender-resolver';
import type { EmailTemplateEngine } from './templates/template.engine';
import type { INotificationChannel } from './notification-channel.interface';

function makeDispatcher() {
  const channel: INotificationChannel = {
    channel: 'email',
    provider: 'smtp',
    send: jest.fn().mockResolvedValue({ messageId: 'msg-1', provider: 'smtp', channel: 'email', raw: {} }),
    verify: jest.fn().mockResolvedValue(true),
    health: jest.fn().mockResolvedValue({ state: 'healthy', channel: 'email', provider: 'smtp' }),
    close: jest.fn().mockResolvedValue(undefined),
    supports: jest.fn().mockReturnValue(true),
  };
  const router = { get: jest.fn().mockReturnValue(channel) } as unknown as ChannelRouter;
  const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
  const tracking = {
    createQueued: jest.fn().mockResolvedValue('del-1'),
    attachJob: jest.fn().mockResolvedValue(null),
    markProcessing: jest.fn().mockResolvedValue(null),
    markSent: jest.fn().mockResolvedValue(null),
    markAttemptFailed: jest.fn().mockResolvedValue(null),
  } as unknown as DeliveryTracker;
  const templates = { render: jest.fn().mockReturnValue({ subject: 'S', html: '<p>B</p>', text: 'B' }) } as unknown as EmailTemplateEngine;
  const senders = { emailFor: jest.fn().mockResolvedValue({}) } as unknown as SenderResolver;
  const config = { get: () => ({ queue: { attempts: 5 }, defaultLocale: 'en' }) };

  const dispatcher = new NotificationDispatcher(router, queue as never, tracking, templates, senders, config as never);
  return { dispatcher, router, channel, queue, tracking, templates };
}

describe('NotificationDispatcher', () => {
  it('dispatch() tracks, enqueues on the shared queue with retries, attaches job id', async () => {
    const { dispatcher, queue, tracking } = makeDispatcher();
    const res = await dispatcher.dispatch({ channel: 'email', to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' });
    expect(tracking.createQueued).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'send-notification',
      expect.objectContaining({ deliveryId: 'del-1', channel: 'email' }),
      expect.objectContaining({ attempts: 5, backoff: { type: 'custom' } }),
    );
    expect(res).toEqual({ deliveryId: 'del-1', jobId: 'job-1' });
  });

  it('validates email recipients + content', async () => {
    const { dispatcher } = makeDispatcher();
    await expect(dispatcher.dispatch({ channel: 'email', to: '', subject: 'Hi', html: '<p>x</p>' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(dispatcher.dispatch({ channel: 'email', to: 'a@b.com', subject: 'Hi' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to queue live stream attachments', async () => {
    const { dispatcher } = makeDispatcher();
    await expect(
      dispatcher.dispatch({ channel: 'email', to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', attachments: [{ filename: 'f', content: Readable.from('x') }] }),
    ).rejects.toThrow(/stream/i);
  });

  it('base64-encodes buffer attachments for the queue', async () => {
    const { dispatcher, queue } = makeDispatcher();
    await dispatcher.dispatch({ channel: 'email', to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', attachments: [{ filename: 'f', content: Buffer.from('hello') }] });
    const jobData = queue.add.mock.calls[0]![1] as { message: { attachments: { encoding: string; content: string }[] } };
    expect(jobData.message.attachments[0]!.encoding).toBe('base64');
  });

  it('dispatchNow() delivers via the channel and marks sent', async () => {
    const { dispatcher, channel, tracking } = makeDispatcher();
    const r = await dispatcher.dispatchNow({ channel: 'email', to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' });
    expect(channel.send).toHaveBeenCalled();
    expect(tracking.markProcessing).toHaveBeenCalledWith('del-1');
    expect(tracking.markSent).toHaveBeenCalled();
    expect(r.messageId).toBe('msg-1');
  });

  it('dispatchTemplate() renders then enqueues on the given channel', async () => {
    const { dispatcher, templates, queue } = makeDispatcher();
    await dispatcher.dispatchTemplate('email', 'ticket-assigned', 'a@b.com', { ticketNumber: 'T1' });
    expect(templates.render).toHaveBeenCalledWith('ticket-assigned', { ticketNumber: 'T1' }, 'en');
    expect(queue.add).toHaveBeenCalled();
  });

  it('deliver() re-throws provider errors so the worker can retry', async () => {
    const { dispatcher, channel } = makeDispatcher();
    (channel.send as jest.Mock).mockRejectedValueOnce(new Error('smtp down'));
    await expect(dispatcher.deliver({ deliveryId: 'del-1', channel: 'email', message: { channel: 'email', to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' } })).rejects.toThrow('smtp down');
  });
});
