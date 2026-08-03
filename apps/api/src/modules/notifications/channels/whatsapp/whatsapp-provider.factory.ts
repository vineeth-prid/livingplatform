import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/configuration';
import { MetaCloudProvider } from './meta-cloud.provider';
import { OpenWaProvider } from './openwa.provider';
import type { WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * The single place that selects the WhatsApp provider from configuration
 * (WHATSAPP_PROVIDER). Adding a provider = one case here; nothing else changes.
 *
 *   meta   → the official Meta Cloud API (templates, business verification)
 *   openwa → a self-hosted OpenWA gateway (QR pairing, no template approval)
 */
export class WhatsAppProviderFactory {
  private static readonly logger = new Logger(WhatsAppProviderFactory.name);

  static create(config: ConfigService<AppConfig, true>): WhatsAppProvider {
    const wa = config.get('whatsapp', { infer: true });
    switch (wa.provider) {
      case 'meta':
        return new MetaCloudProvider(wa.meta);
      case 'openwa':
        return new OpenWaProvider(wa.openwa);
      default:
        WhatsAppProviderFactory.logger.warn(`Unknown WHATSAPP_PROVIDER "${wa.provider}", falling back to meta`);
        return new MetaCloudProvider(wa.meta);
    }
  }
}
