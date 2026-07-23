import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/configuration';
import { EmailProviderFactory } from './email-provider.factory';
import type { EmailProvider } from './email-provider.interface';

const SUPPORTED = new Set(['ses', 'smtp']);

/**
 * Holds the single active email provider. The initial provider comes ONLY from
 * configuration (EMAIL_PROVIDER); business modules never see this. `switchTo`
 * lets a Platform Admin hot-swap the provider at runtime (e.g. failover) without
 * a redeploy — it rebuilds via the factory and closes the previous one. The
 * default on boot always follows config.
 */
@Injectable()
export class EmailProviderRegistry implements OnModuleDestroy {
  private readonly logger = new Logger(EmailProviderRegistry.name);
  private provider: EmailProvider;
  private overridden = false;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.provider = EmailProviderFactory.create(config);
    this.logger.log(`Email provider initialised from config: ${this.provider.name}`);
  }

  get current(): EmailProvider {
    return this.provider;
  }

  /** The provider configured in the environment (the boot default). */
  get configured(): string {
    return this.config.get('email', { infer: true }).provider;
  }

  /** True when the live provider was switched away from the configured one. */
  get isOverridden(): boolean {
    return this.overridden;
  }

  async switchTo(name: string): Promise<EmailProvider> {
    const target = name.toLowerCase();
    if (!SUPPORTED.has(target)) {
      throw new BadRequestException(`Unsupported email provider "${name}". Supported: ${[...SUPPORTED].join(', ')}`);
    }
    if (target === this.provider.name) return this.provider;
    const next = EmailProviderFactory.create(this.config, target);
    const previous = this.provider;
    this.provider = next;
    this.overridden = target !== this.configured;
    await previous.close().catch((e) => this.logger.warn(`Closing previous provider failed: ${(e as Error).message}`));
    this.logger.warn(`Email provider switched at runtime → ${target} (configured: ${this.configured})`);
    return next;
  }

  async onModuleDestroy(): Promise<void> {
    await this.provider.close().catch(() => undefined);
  }
}
