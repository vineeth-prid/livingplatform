import { BadRequestException, Logger } from '@nestjs/common';

import { OpenWaClient, type OpenWaConfig } from './openwa.client';
import type {
  WaHealth,
  WaInteractive,
  WaLocation,
  WaMedia,
  WaSendResult,
  WaTemplate,
  WhatsAppProvider,
} from './whatsapp-provider.interface';

/**
 * OpenWA as a WhatsApp provider.
 *
 * Implements the SAME WhatsAppProvider contract as MetaCloudProvider, so the
 * WhatsAppChannel — and therefore the whole Notification Engine (dispatcher,
 * queue, retry, delivery tracking, metrics) — is unchanged. Switching between
 * the official Cloud API and a self-hosted gateway is one env var.
 *
 * Where OpenWA has no equivalent of a Meta concept, the provider degrades
 * honestly rather than silently: WhatsApp *templates* are a Meta Business
 * construct, so a template send is rendered to text (an unofficial gateway
 * sends from a real phone and does not need pre-approved templates).
 */
export class OpenWaProvider implements WhatsAppProvider {
  readonly name = 'openwa';
  private readonly logger = new Logger(OpenWaProvider.name);
  private readonly client: OpenWaClient;

  constructor(config: OpenWaConfig) {
    this.client = new OpenWaClient(config);
  }

  /** Exposed so the session manager drives the same connection. */
  get gateway(): OpenWaClient {
    return this.client;
  }

  async sendText(to: string, body: string, previewUrl = false): Promise<WaSendResult> {
    const res = await this.client.sendText(to, body, previewUrl);
    return { messageId: res.id, provider: this.name, raw: res.raw };
  }

  /**
   * Templates: OpenWA sends from a personal/business number and has no template
   * registry, so the template's body parameters are flattened into text. The
   * caller's variables still come from the platform's own template engine.
   */
  async sendTemplate(to: string, template: WaTemplate): Promise<WaSendResult> {
    const text = flattenTemplate(template);
    if (!text) {
      throw new BadRequestException(
        'OpenWA cannot send a Meta template with no renderable body — dispatch text instead',
      );
    }
    return this.sendText(to, text);
  }

  async sendMedia(to: string, media: WaMedia): Promise<WaSendResult> {
    if (!media.link && !media.id) {
      throw new BadRequestException('WhatsApp media requires a link or an uploaded media id');
    }
    const res = await this.client.sendMedia(to, {
      url: media.link,
      base64: media.id?.startsWith('data:') ? media.id : undefined,
      caption: media.caption,
      filename: media.filename,
      type: media.type,
    });
    return { messageId: res.id, provider: this.name, raw: res.raw };
  }

  async sendInteractive(to: string, interactive: WaInteractive): Promise<WaSendResult> {
    const res = await this.client.sendButtons(to, interactive as Record<string, unknown>);
    return { messageId: res.id, provider: this.name, raw: res.raw };
  }

  async sendLocation(to: string, location: WaLocation): Promise<WaSendResult> {
    const res = await this.client.sendLocation(to, location);
    return { messageId: res.id, provider: this.name, raw: res.raw };
  }

  /** No contact-card endpoint on the gateway — send a readable text instead. */
  async sendContacts(to: string, contacts: unknown[]): Promise<WaSendResult> {
    const text = contacts
      .map((c) => {
        const contact = c as { name?: { formatted_name?: string }; phones?: Array<{ phone?: string }> };
        return [contact.name?.formatted_name, contact.phones?.[0]?.phone].filter(Boolean).join(' · ');
      })
      .filter(Boolean)
      .join('\n');
    return this.sendText(to, text || 'Contact');
  }

  /**
   * OpenWA takes media inline (URL or base64) rather than pre-uploading, so
   * "upload" returns a data URL that sendMedia understands. No round trip.
   */
  async uploadMedia(content: Buffer, contentType: string): Promise<string> {
    return `data:${contentType};base64,${content.toString('base64')}`;
  }

  async markRead(messageId: string): Promise<void> {
    await this.client.markRead(messageId).catch((err: Error) => {
      // Read receipts are cosmetic — never fail a delivery over one.
      this.logger.debug(`markRead failed for ${messageId}: ${err.message}`);
    });
  }

  async verify(): Promise<boolean> {
    const health = await this.health();
    return health.state === 'healthy';
  }

  async health(): Promise<WaHealth> {
    const started = Date.now();
    try {
      const status = await this.client.status();
      const latencyMs = Date.now() - started;
      if (status.state === 'CONNECTED') {
        return { state: 'healthy', provider: this.name, latencyMs };
      }
      return {
        state: 'unhealthy',
        provider: this.name,
        reason: `Session is ${status.state.toLowerCase().replace('_', ' ')}`,
        latencyMs,
      };
    } catch (err) {
      return {
        state: 'unhealthy',
        provider: this.name,
        reason: (err as Error).message,
        latencyMs: Date.now() - started,
      };
    }
  }

  async close(): Promise<void> {
    // Nothing to release — the gateway owns the WhatsApp socket, and stopping
    // the session here would log the platform out on every deploy.
  }
}

/** Render a Meta template's body parameters into a plain message. */
function flattenTemplate(template: WaTemplate): string {
  const components = (template.components ?? []) as Array<{
    type?: string;
    parameters?: Array<{ type?: string; text?: string }>;
  }>;
  const parts: string[] = [];
  for (const component of components) {
    for (const param of component.parameters ?? []) {
      if (param.text) parts.push(param.text);
    }
  }
  return parts.join('\n').trim();
}
