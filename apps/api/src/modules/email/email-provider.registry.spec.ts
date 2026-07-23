import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { EmailProviderRegistry } from './email-provider.registry';

function config(provider = 'smtp'): ConfigService<Record<string, unknown>, true> {
  const email = {
    provider,
    defaultLocale: 'en',
    ses: { region: 'us-east-1', accessKeyId: 'AK', secretAccessKey: 'SK', fromName: 'Living', fromEmail: 'x@y.com', replyTo: '', configurationSet: '' },
    smtp: { host: 'localhost', port: 1025, secure: false, username: '', password: '', fromName: 'Living', fromEmail: '', replyTo: '' },
    queue: { concurrency: 5, attempts: 5, backoffMs: [60000] },
  };
  return {
    get: (k: string) => (k === 'email' ? email : k === 'mail' ? { from: 'Living <x@y.com>' } : undefined),
  } as unknown as ConfigService<Record<string, unknown>, true>;
}

describe('EmailProviderRegistry', () => {
  it('initialises the provider from configuration', () => {
    const reg = new EmailProviderRegistry(config('smtp'));
    expect(reg.current.name).toBe('smtp');
    expect(reg.configured).toBe('smtp');
    expect(reg.isOverridden).toBe(false);
  });

  it('switches provider at runtime and closes the previous one', async () => {
    const reg = new EmailProviderRegistry(config('smtp'));
    const previous = reg.current;
    const closeSpy = jest.spyOn(previous, 'close');
    const next = await reg.switchTo('ses');
    expect(next.name).toBe('ses');
    expect(reg.current.name).toBe('ses');
    expect(reg.isOverridden).toBe(true); // configured is smtp
    expect(closeSpy).toHaveBeenCalled();
    await reg.onModuleDestroy();
  });

  it('is a no-op when switching to the already-active provider', async () => {
    const reg = new EmailProviderRegistry(config('smtp'));
    const same = await reg.switchTo('smtp');
    expect(same).toBe(reg.current);
  });

  it('rejects an unsupported provider', async () => {
    const reg = new EmailProviderRegistry(config('smtp'));
    await expect(reg.switchTo('sendgrid')).rejects.toBeInstanceOf(BadRequestException);
  });
});
