import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/configuration';
import { MetaCloudProvider } from './meta-cloud.provider';
import type { WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * The single place that selects the WhatsApp provider from configuration
 * (WHATSAPP_PROVIDER). Adding a provider = one case here; nothing else changes.
 */
export class WhatsAppProviderFactory {
  private static readonly logger = new Logger(WhatsAppProviderFactory.name);

  static create(config: ConfigService<AppConfig, true>): WhatsAppProvider {
    const wa = config.get('whatsapp', { infer: true });
    switch (wa.provider) {
      case 'meta':
        return new MetaCloudProvider(wa.meta);
      default:
        WhatsAppProviderFactory.logger.warn(`Unknown WHATSAPP_PROVIDER "${wa.provider}", falling back to meta`);
        return new MetaCloudProvider(wa.meta);
    }
  }
}
