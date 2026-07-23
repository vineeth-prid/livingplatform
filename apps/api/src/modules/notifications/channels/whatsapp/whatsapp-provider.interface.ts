/**
 * Provider-agnostic WhatsApp contract. The WhatsAppChannel depends only on this;
 * a future provider (e.g. an on-prem/BSP gateway) implements it and registers in
 * the WhatsAppProviderFactory — nothing else changes.
 */

export interface WaSendResult {
  messageId: string | null;
  provider: string;
  raw?: unknown;
}

export type WaMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface WaMedia {
  type: WaMediaType;
  /** Public URL of the media, OR a pre-uploaded media id (link XOR id). */
  link?: string;
  id?: string;
  caption?: string;
  filename?: string;
}

export interface WaTemplate {
  name: string;
  language: string; // e.g. 'en_US'
  components?: unknown[]; // Meta template components (header/body/button params)
}

export interface WaInteractive {
  // Passed through to Meta's `interactive` object (button | list | etc.).
  [key: string]: unknown;
}

export interface WaLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export type WaHealthState = 'healthy' | 'unhealthy';
export interface WaHealth {
  state: WaHealthState;
  provider: string;
  reason?: string;
  latencyMs?: number;
}

export interface WhatsAppProvider {
  readonly name: string;

  sendText(to: string, body: string, previewUrl?: boolean): Promise<WaSendResult>;
  sendTemplate(to: string, template: WaTemplate): Promise<WaSendResult>;
  sendMedia(to: string, media: WaMedia): Promise<WaSendResult>;
  sendInteractive(to: string, interactive: WaInteractive): Promise<WaSendResult>;
  sendLocation(to: string, location: WaLocation): Promise<WaSendResult>;
  sendContacts(to: string, contacts: unknown[]): Promise<WaSendResult>;

  /** Upload media bytes; returns a media id usable in sendMedia. */
  uploadMedia(content: Buffer, contentType: string, filename?: string): Promise<string>;
  /** Mark an inbound message as read (blue ticks). */
  markRead(messageId: string): Promise<void>;

  verify(): Promise<boolean>;
  health(): Promise<WaHealth>;
  close(): Promise<void>;
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
