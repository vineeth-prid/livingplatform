import { BadGatewayException, Logger } from '@nestjs/common';

/**
 * Raw HTTP client for a self-hosted OpenWA gateway
 * (github.com/rmyndharis/OpenWA). Dependency-free (global fetch), no state.
 *
 * OpenWA is a community project whose response envelopes vary a little between
 * engines (whatsapp-web.js vs baileys) and versions, so every read here is
 * tolerant: we look for a value in the shapes the gateway is known to use and
 * fall back rather than throwing on an unexpected key.
 */

export interface OpenWaConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
  timeoutMs: number;
  defaultCountryCode: string;
}

export type OpenWaSessionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_PENDING'
  | 'CONNECTED'
  | 'FAILED';

export interface OpenWaStatus {
  state: OpenWaSessionState;
  phoneNumber: string | null;
  raw: unknown;
}

export class OpenWaClient {
  private readonly logger = new Logger(OpenWaClient.name);

  constructor(private readonly config: OpenWaConfig) {}

  get session(): string {
    return this.config.session;
  }

  /**
   * `9876543210` / `+91 98765 43210` → `919876543210@c.us`. A number that is
   * already a chat id (group or contact) passes through untouched.
   */
  toChatId(recipient: string): string {
    if (recipient.includes('@')) return recipient;
    let digits = recipient.replace(/\D/g, '');
    if (digits.length === 10) digits = `${this.config.defaultCountryCode}${digits}`;
    return `${digits}@c.us`;
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async createSession(name = this.config.session): Promise<{ id: string }> {
    const res = await this.request<Record<string, unknown>>('POST', '/api/sessions', { name });
    return { id: pickString(res, ['id', 'sessionId', 'name']) ?? name };
  }

  async startSession(session = this.config.session): Promise<void> {
    await this.request('POST', `/api/sessions/${encodeURIComponent(session)}/start`, {});
  }

  async stopSession(session = this.config.session): Promise<void> {
    await this.request('POST', `/api/sessions/${encodeURIComponent(session)}/stop`, {});
  }

  async deleteSession(session = this.config.session): Promise<void> {
    await this.request('DELETE', `/api/sessions/${encodeURIComponent(session)}`);
  }

  /** Current QR payload for scanning, or null once the session is authenticated. */
  async qr(session = this.config.session): Promise<{ qr: string | null; dataUrl: string | null }> {
    const res = await this.request<Record<string, unknown>>(
      'GET',
      `/api/sessions/${encodeURIComponent(session)}/qr`,
    );
    const qr = pickString(res, ['qr', 'code', 'qrCode']);
    const dataUrl = pickString(res, ['dataUrl', 'qrImage', 'base64', 'image']);
    return { qr: qr ?? null, dataUrl: dataUrl ?? null };
  }

  async status(session = this.config.session): Promise<OpenWaStatus> {
    const res = await this.request<Record<string, unknown>>(
      'GET',
      `/api/sessions/${encodeURIComponent(session)}`,
    );
    return {
      state: normalizeState(pickString(res, ['status', 'state', 'connectionState'])),
      phoneNumber: pickString(res, ['phoneNumber', 'phone', 'me', 'wid']) ?? null,
      raw: res,
    };
  }

  /** Register a callback URL for inbound messages and session-status events. */
  async registerWebhook(
    url: string,
    events: string[],
    session = this.config.session,
  ): Promise<void> {
    await this.request('POST', `/api/sessions/${encodeURIComponent(session)}/webhooks`, {
      url,
      events,
    });
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  async sendText(to: string, text: string, previewUrl = false): Promise<{ id: string | null; raw: unknown }> {
    const res = await this.send('send-text', { chatId: this.toChatId(to), text, previewUrl });
    return res;
  }

  async sendMedia(
    to: string,
    media: { url?: string; base64?: string; caption?: string; filename?: string; type?: string },
  ): Promise<{ id: string | null; raw: unknown }> {
    return this.send('send-media', {
      chatId: this.toChatId(to),
      url: media.url,
      base64: media.base64,
      caption: media.caption,
      filename: media.filename,
      type: media.type,
    });
  }

  async sendLocation(
    to: string,
    location: { latitude: number; longitude: number; name?: string; address?: string },
  ): Promise<{ id: string | null; raw: unknown }> {
    return this.send('send-location', { chatId: this.toChatId(to), ...location });
  }

  async sendButtons(to: string, payload: Record<string, unknown>): Promise<{ id: string | null; raw: unknown }> {
    return this.send('send-buttons', { chatId: this.toChatId(to), ...payload });
  }

  async markRead(messageId: string, session = this.config.session): Promise<void> {
    await this.request('POST', `/api/sessions/${encodeURIComponent(session)}/messages/read`, {
      messageId,
    });
  }

  private async send(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string | null; raw: unknown }> {
    const res = await this.request<Record<string, unknown>>(
      'POST',
      `/api/sessions/${encodeURIComponent(this.config.session)}/messages/${endpoint}`,
      body,
    );
    const nested = (res.data ?? res.message ?? res) as Record<string, unknown>;
    return { id: pickString(nested, ['id', 'messageId', 'key']) ?? null, raw: res };
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          'X-API-Key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      const parsed = text ? safeJson(text) : {};
      if (!res.ok) {
        const message =
          pickString(parsed as Record<string, unknown>, ['message', 'error', 'detail']) ??
          `OpenWA responded ${res.status}`;
        this.logger.warn(`OpenWA ${method} ${path} failed: ${res.status}`);
        throw new BadGatewayException(message);
      }
      return parsed as T;
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new BadGatewayException('OpenWA gateway timed out');
      }
      throw new BadGatewayException(`OpenWA gateway is unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Map the gateway's many status spellings onto our five states. */
export function normalizeState(raw: string | undefined): OpenWaSessionState {
  const s = (raw ?? '').toUpperCase();
  if (['CONNECTED', 'AUTHENTICATED', 'READY', 'OPEN', 'WORKING', 'ONLINE'].includes(s)) {
    return 'CONNECTED';
  }
  if (['QR', 'QR_PENDING', 'SCAN_QR_CODE', 'SCAN_QR', 'PAIRING', 'QRCODE'].includes(s)) {
    return 'QR_PENDING';
  }
  if (['STARTING', 'CONNECTING', 'INITIALIZING', 'OPENING', 'LOADING'].includes(s)) {
    return 'CONNECTING';
  }
  if (['FAILED', 'ERROR', 'CONFLICT', 'UNPAIRED', 'BANNED'].includes(s)) return 'FAILED';
  return 'DISCONNECTED';
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (value && typeof value === 'object') {
      const inner = (value as Record<string, unknown>)._serialized ?? (value as Record<string, unknown>).id;
      if (typeof inner === 'string' && inner.length > 0) return inner;
    }
  }
  // OpenWA commonly wraps payloads in { data: … } or { session: … }.
  for (const wrapper of ['data', 'session', 'result']) {
    const nested = obj[wrapper];
    if (nested && typeof nested === 'object') {
      const found = pickString(nested as Record<string, unknown>, keys);
      if (found) return found;
    }
  }
  return undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
