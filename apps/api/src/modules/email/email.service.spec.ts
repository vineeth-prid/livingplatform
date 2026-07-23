import { Readable } from 'node:stream';

import { BadRequestException } from '@nestjs/common';

import { EmailService } from './email.service';
import type { EmailProviderRegistry } from './email-provider.registry';
import type { EmailTrackingService } from './email.tracking.service';
import type { EmailTemplateEngine } from './templates/template.engine';

function makeService() {
  const provider = {
    name: 'smtp',
    send: jest.fn().mockResolvedValue({ messageId: 'msg-1', provider: 'smtp', raw: { ok: true } }),
    verify: jest.fn().mockResolvedValue(true),
    health: jest.fn().mockResolvedValue({ state: 'healthy', provider: 'smtp' }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const registry = { current: provider } as unknown as EmailProviderRegistry;
  const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
  const tracking = {
    createQueued: jest.fn().mockResolvedValue('del-1'),
    attachJob: jest.fn().mockResolvedValue(null),
    markProcessing: jest.fn().mockResolvedValue(null),
    markSent: jest.fn().mockResolvedValue(null),
    markAttemptFailed: jest.fn().mockResolvedValue(null),
    markFailed: jest.fn().mockResolvedValue(null),
  } as unknown as EmailTrackingService;
  const templates = {
    render: jest.fn().mockReturnValue({ subject: 'Subject', html: '<p>Body</p>', text: 'Body' }),
  } as unknown as EmailTemplateEngine;
  const config = { get: () => ({ queue: { attempts: 5 }, defaultLocale: 'en' }) };

  const service = new EmailService(
    registry,
    queue as never,
    tracking,
    templates,
    config as never,
  );
  return { service, provider, queue, tracking, templates };
}

describe('EmailService', () => {
  it('exposes the active provider name', () => {
    const { service } = makeService();
    expect(service.providerName).toBe('smtp');
  });

  it('send() records tracking, enqueues with retries, and attaches the job id', async () => {
    const { service, queue, tracking } = makeService();
    const res = await service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' });
    expect(tracking.createQueued).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({ deliveryId: 'del-1', provider: 'smtp' }),
      expect.objectContaining({ attempts: 5, backoff: { type: 'custom' } }),
    );
    expect(tracking.attachJob).toHaveBeenCalledWith('del-1', 'job-1');
    expect(res).toEqual({ deliveryId: 'del-1', jobId: 'job-1' });
  });

  it('rejects a message with no recipients', async () => {
    const { service } = makeService();
    await expect(service.send({ to: '', subject: 'Hi', html: '<p>x</p>' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a message with no content', async () => {
    const { service } = makeService();
    await expect(service.send({ to: 'a@b.com', subject: 'Hi' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to queue live stream attachments (must use sendNow)', async () => {
    const { service } = makeService();
    await expect(
      service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', attachments: [{ filename: 'f.txt', content: Readable.from('x') }] }),
    ).rejects.toThrow(/stream/i);
  });

  it('base64-encodes buffer attachments for the queue', async () => {
    const { service, queue } = makeService();
    await service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', attachments: [{ filename: 'f.txt', content: Buffer.from('hello') }] });
    const jobData = (queue.add.mock.calls[0]![1]) as { message: { attachments: { content: string; encoding: string }[] } };
    expect(jobData.message.attachments[0]!.encoding).toBe('base64');
    expect(jobData.message.attachments[0]!.content).toBe(Buffer.from('hello').toString('base64'));
  });

  it('sendNow() delivers immediately via the provider and marks sent', async () => {
    const { service, provider, tracking } = makeService();
    const result = await service.sendNow({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' });
    expect(provider.send).toHaveBeenCalled();
    expect(tracking.markProcessing).toHaveBeenCalledWith('del-1');
    expect(tracking.markSent).toHaveBeenCalled();
    expect(result.messageId).toBe('msg-1');
  });

  it('sendTemplate() renders then enqueues', async () => {
    const { service, templates, queue } = makeService();
    await service.sendTemplate('ticket-assigned', 'a@b.com', { ticketNumber: 'T1' });
    expect(templates.render).toHaveBeenCalledWith('ticket-assigned', { ticketNumber: 'T1' }, 'en');
    expect(queue.add).toHaveBeenCalled();
  });

  it('sendTest() sends immediately through the active provider', async () => {
    const { service, provider } = makeService();
    const res = await service.sendTest('ops@living.local');
    expect(provider.send).toHaveBeenCalled();
    expect(res.provider).toBe('smtp');
  });

  it('deliver() re-throws provider errors so the queue can retry', async () => {
    const { service, provider } = makeService();
    (provider.send as jest.Mock).mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.deliver({ deliveryId: 'del-1', provider: 'smtp', message: { to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' } })).rejects.toThrow('smtp down');
  });

  it('verify() and health() delegate to the provider', async () => {
    const { service, provider } = makeService();
    await service.verify();
    await service.health();
    expect(provider.verify).toHaveBeenCalled();
    expect(provider.health).toHaveBeenCalled();
  });
});
