import { Logger } from '@nestjs/common';

import type {
  WaHealth, WaInteractive, WaLocation, WaMedia, WaSendResult, WaTemplate, WhatsAppProvider,
} from './whatsapp-provider.interface';

export interface MetaCloudConfig {
  apiVersion: string;
  graphBaseUrl: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
}

interface MetaResponse {
  messages?: { id: string }[];
  error?: { message?: string };
}

/**
 * WhatsApp via the official Meta Cloud API (Graph). Supports text, template,
 * media (image/video/audio/document), interactive (buttons/list), location,
 * contacts, media upload and read receipts. Uses the global fetch — no extra
 * HTTP dependency. Retries are the engine's job, so this never retries.
 */
export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = 'meta';
  private readonly logger = new Logger(MetaCloudProvider.name);
  private readonly base: string;

  constructor(private readonly config: MetaCloudConfig) {
    this.base = `${config.graphBaseUrl.replace(/\/$/, '')}/${config.apiVersion}`;
  }

  private assertConfigured(): void {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      throw new Error('WhatsApp is not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)');
    }
  }

  private async post(path: string, body: unknown): Promise<MetaResponse> {
    this.assertConfigured();
    const res = await fetch(`${this.base}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as MetaResponse;
    if (!res.ok) throw new Error(json.error?.message ?? `Meta API error ${res.status}`);
    return json;
  }

  private message(to: string, extra: Record<string, unknown>): Record<string, unknown> {
    return { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...extra };
  }

  private result(json: MetaResponse): WaSendResult {
    return { messageId: json.messages?.[0]?.id ?? null, provider: this.name, raw: json };
  }

  async sendText(to: string, body: string, previewUrl = false): Promise<WaSendResult> {
    const json = await this.post(`${this.config.phoneNumberId}/messages`, this.message(to, { type: 'text', text: { body, preview_url: previewUrl } }));
    return this.result(json);
  }

  async sendTemplate(to: string, template: WaTemplate): Promise<WaSendResult> {
    const json = await this.post(`${this.config.phoneNumberId}/messages`, this.message(to, {
      type: 'template',
      template: { name: template.name, language: { code: template.language }, ...(template.components ? { components: template.components } : {}) },
    }));
    return this.result(json);
  }

  async sendMedia(to: string, media: WaMedia): Promise<WaSendResult> {
    const payload = media.id
      ? { id: media.id, ...(media.caption ? { caption: media.caption } : {}), ...(media.filename ? { filename: media.filename } : {}) }
      : { link: media.link, ...(media.caption ? { caption: media.caption } : {}), ...(media.filename ? { filename: media.filename } : {}) };
    const json = await this.post(`${this.config.phoneNumberId}/messages`, this.message(to, { type: media.type, [media.type]: payload }));
    return this.result(json);
  }

  async sendInteractive(to: string, interactive: WaInteractive): Promise<WaSendResult> {
    const json = await this.post(`${this.config.phoneNumberId}/messages`, this.message(to, { type: 'interactive', interactive }));
    return this.result(json);
  }

  async sendLocation(to: string, location: WaLocation): Promise<WaSendResult> {
    const json = await this.post(`${this.config.phoneNumberId}/messages`, this.message(to, { type: 'location', location }));
    return this.result(json);
  }

  async sendContacts(to: string, contacts: unknown[]): Promise<WaSendResult> {
    const json = await this.post(`${this.config.phoneNumberId}/messages`, this.message(to, { type: 'contacts', contacts }));
    return this.result(json);
  }

  async uploadMedia(content: Buffer, contentType: string, filename = 'file'): Promise<string> {
    this.assertConfigured();
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', contentType);
    form.append('file', new Blob([content], { type: contentType }), filename);
    const res = await fetch(`${this.base}/${this.config.phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) throw new Error(json.error?.message ?? `Media upload failed (${res.status})`);
    return json.id;
  }

  async markRead(messageId: string): Promise<void> {
    await this.post(`${this.config.phoneNumberId}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: messageId });
  }

  async verify(): Promise<boolean> {
    this.assertConfigured();
    const res = await fetch(`${this.base}/${this.config.phoneNumberId}?fields=verified_name,display_phone_number`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    if (!res.ok) throw new Error(`Meta API verify failed (${res.status})`);
    return true;
  }

  async health(): Promise<WaHealth> {
    const start = Date.now();
    try {
      await this.verify();
      return { state: 'healthy', provider: this.name, latencyMs: Date.now() - start };
    } catch (err) {
      return { state: 'unhealthy', provider: this.name, reason: (err as Error).message, latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    this.logger.debug('Meta Cloud provider closed (stateless HTTP client)');
  }
}
