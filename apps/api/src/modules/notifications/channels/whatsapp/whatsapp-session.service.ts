import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WhatsAppSessionStatus, type WhatsAppSession } from '@prisma/client';

import { SecretCipher } from '../../../../common/crypto/secret-cipher';
import type { AppConfig } from '../../../../config/configuration';
import { DomainEventName } from '../../../events/domain-events';
import { DomainEventsService } from '../../../events/domain-events.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpenWaClient, normalizeState, type OpenWaSessionState } from './openwa.client';
import { OpenWaProvider } from './openwa.provider';
import { WhatsAppChannel } from './whatsapp.channel';

const STATE_TO_STATUS: Record<OpenWaSessionState, WhatsAppSessionStatus> = {
  DISCONNECTED: WhatsAppSessionStatus.DISCONNECTED,
  CONNECTING: WhatsAppSessionStatus.CONNECTING,
  QR_PENDING: WhatsAppSessionStatus.QR_PENDING,
  CONNECTED: WhatsAppSessionStatus.CONNECTED,
  FAILED: WhatsAppSessionStatus.FAILED,
};

export interface SessionView {
  id: string;
  name: string;
  provider: string;
  status: WhatsAppSessionStatus;
  phoneNumber: string | null;
  isDefault: boolean;
  hasApiKey: boolean;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastError: string | null;
  updatedAt: Date;
}

/**
 * Connection manager for the OpenWA gateway.
 *
 * The gateway owns the WhatsApp socket and its credential store; this service
 * owns the platform's *view* of it — the session row, its status, the last QR,
 * and the reconnect policy. That split is what makes session persistence work
 * across API restarts: nothing here holds the WhatsApp session in memory.
 *
 * A watchdog polls the gateway on OPENWA_HEALTH_INTERVAL_SEC and restarts a
 * session that has dropped (OPENWA_AUTO_RECONNECT). Every transition is
 * recorded and published as a domain event, so the audit trail shows exactly
 * when the platform's WhatsApp went down.
 */
@Injectable()
export class WhatsAppSessionService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppSessionService.name);
  private readonly defaultSession: string;
  private readonly autoReconnect: boolean;
  private readonly healthIntervalSec: number;
  private readonly isOpenWa: boolean;
  private polling = false;
  private lastPollAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly channel: WhatsAppChannel,
    private readonly cipher: SecretCipher,
    private readonly events: DomainEventsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const wa = this.config.get('whatsapp', { infer: true });
    this.isOpenWa = wa.provider === 'openwa';
    this.defaultSession = wa.openwa.session;
    this.autoReconnect = wa.openwa.autoReconnect;
    this.healthIntervalSec = wa.openwa.healthIntervalSec;
  }

  /** Make sure the configured session has a row, so the admin UI is never empty. */
  async onModuleInit(): Promise<void> {
    if (!this.isOpenWa) return;
    await this.prisma.whatsAppSession
      .upsert({
        where: { name: this.defaultSession },
        create: { name: this.defaultSession, provider: 'openwa', isDefault: true },
        update: {},
      })
      .catch((err: Error) => {
        // A DB that is not up yet must not block API boot.
        this.logger.warn(`Could not ensure the default WhatsApp session row: ${err.message}`);
      });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async list(): Promise<SessionView[]> {
    const rows = await this.prisma.whatsAppSession.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toView);
  }

  /** Session row refreshed from the live gateway status. */
  async status(name = this.defaultSession): Promise<SessionView & { reachable: boolean }> {
    const row = await this.require(name);
    if (!this.isOpenWa) return { ...toView(row), reachable: false };
    try {
      const live = await this.client().status(name);
      const updated = await this.applyState(row, live.state, live.phoneNumber);
      return { ...toView(updated), reachable: true };
    } catch (err) {
      const updated = await this.recordError(row, (err as Error).message);
      return { ...toView(updated), reachable: false };
    }
  }

  /**
   * The QR to scan. Returns null once the session is authenticated — the UI
   * uses that to swap the QR panel for the connected state.
   */
  async qr(name = this.defaultSession): Promise<{ qr: string | null; dataUrl: string | null; status: WhatsAppSessionStatus }> {
    this.assertOpenWa();
    const row = await this.require(name);
    const result = await this.client().qr(name);
    const status = result.qr || result.dataUrl ? WhatsAppSessionStatus.QR_PENDING : row.status;
    await this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: {
        status,
        lastQr: result.qr ?? result.dataUrl ?? null,
        lastQrAt: result.qr || result.dataUrl ? new Date() : row.lastQrAt,
      },
    });
    return { ...result, status };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Create the session on the gateway (idempotent) and start QR pairing. */
  async connect(name = this.defaultSession, actorId?: string): Promise<SessionView> {
    this.assertOpenWa();
    const row = await this.ensureRow(name, actorId);
    const client = this.client();
    // Creating an existing session is a no-op on the gateway; tolerate the 409.
    await client.createSession(name).catch(() => undefined);
    await client.startSession(name);
    await this.registerWebhook(name).catch((err: Error) => {
      this.logger.warn(`Could not register the OpenWA webhook: ${err.message}`);
    });
    const updated = await this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: { status: WhatsAppSessionStatus.CONNECTING, lastError: null, updatedById: actorId },
    });
    this.logger.log(`WhatsApp session "${name}" starting`);
    return toView(updated);
  }

  /** Restart a session without dropping its stored pairing. */
  async reconnect(name = this.defaultSession, actorId?: string): Promise<SessionView> {
    this.assertOpenWa();
    const client = this.client();
    await client.stopSession(name).catch(() => undefined);
    await client.startSession(name);
    const row = await this.require(name);
    const updated = await this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: { status: WhatsAppSessionStatus.CONNECTING, lastError: null, updatedById: actorId },
    });
    this.logger.log(`WhatsApp session "${name}" reconnecting`);
    return toView(updated);
  }

  /** Log out and clear the pairing — the next connect needs a fresh QR scan. */
  async disconnect(name = this.defaultSession, actorId?: string): Promise<SessionView> {
    this.assertOpenWa();
    await this.client().stopSession(name).catch(() => undefined);
    const row = await this.require(name);
    const updated = await this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: {
        status: WhatsAppSessionStatus.DISCONNECTED,
        lastDisconnectedAt: new Date(),
        lastQr: null,
        updatedById: actorId,
      },
    });
    this.publish(DomainEventName.WhatsAppSessionDisconnected, updated, 'manual disconnect');
    return toView(updated);
  }

  /** Store a session-scoped gateway API key (encrypted at rest). */
  async setApiKey(name: string, apiKey: string, actorId?: string): Promise<SessionView> {
    if (!this.cipher.isConfigured) {
      throw new BadRequestException(
        'Secret encryption is not configured on this deployment (APP_ENCRYPTION_KEY)',
      );
    }
    const row = await this.ensureRow(name, actorId);
    const updated = await this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: { apiKeyEnc: apiKey ? this.cipher.encrypt(apiKey) : null, updatedById: actorId },
    });
    return toView(updated);
  }

  // ── Watchdog ───────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE, { name: 'whatsapp-connection-watchdog' })
  async watchdog(): Promise<void> {
    if (!this.isOpenWa || this.healthIntervalSec <= 0 || this.polling) return;
    if (Date.now() - this.lastPollAt < this.healthIntervalSec * 1000) return;
    this.polling = true;
    this.lastPollAt = Date.now();
    try {
      const rows = await this.prisma.whatsAppSession.findMany({ where: { provider: 'openwa' } });
      for (const row of rows) {
        await this.pollOne(row);
      }
    } catch (err) {
      this.logger.error('WhatsApp watchdog failed', err as Error);
    } finally {
      this.polling = false;
    }
  }

  private async pollOne(row: WhatsAppSession): Promise<void> {
    try {
      const live = await this.client().status(row.name);
      const updated = await this.applyState(row, live.state, live.phoneNumber);
      if (
        this.autoReconnect &&
        (updated.status === WhatsAppSessionStatus.DISCONNECTED ||
          updated.status === WhatsAppSessionStatus.FAILED)
      ) {
        this.logger.warn(`Auto-reconnecting WhatsApp session "${row.name}" (${updated.status})`);
        await this.client().startSession(row.name).catch(() => undefined);
      }
    } catch (err) {
      await this.recordError(row, (err as Error).message);
    }
  }

  // ── Webhook ingestion (called by the OpenWA webhook controller) ────────────

  /** Apply a session.status event pushed by the gateway. */
  async applyWebhookStatus(name: string, rawState: string, phoneNumber?: string): Promise<void> {
    const row = await this.prisma.whatsAppSession.findUnique({ where: { name } });
    if (!row) return;
    await this.applyState(row, normalizeState(rawState), phoneNumber ?? null);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async applyState(
    row: WhatsAppSession,
    state: OpenWaSessionState,
    phoneNumber: string | null,
  ): Promise<WhatsAppSession> {
    const status = STATE_TO_STATUS[state];
    if (status === row.status && phoneNumber === row.phoneNumber) return row;

    const updated = await this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: {
        status,
        phoneNumber: phoneNumber ?? row.phoneNumber,
        lastError: status === WhatsAppSessionStatus.CONNECTED ? null : row.lastError,
        ...(status === WhatsAppSessionStatus.CONNECTED
          ? { lastConnectedAt: new Date(), lastQr: null }
          : {}),
        ...(row.status === WhatsAppSessionStatus.CONNECTED &&
        status !== WhatsAppSessionStatus.CONNECTED
          ? { lastDisconnectedAt: new Date() }
          : {}),
      },
    });

    if (status === WhatsAppSessionStatus.CONNECTED && row.status !== status) {
      this.publish(DomainEventName.WhatsAppSessionConnected, updated);
    } else if (row.status === WhatsAppSessionStatus.CONNECTED && status !== WhatsAppSessionStatus.CONNECTED) {
      this.publish(DomainEventName.WhatsAppSessionDisconnected, updated, `state ${state}`);
    }
    return updated;
  }

  private async recordError(row: WhatsAppSession, message: string): Promise<WhatsAppSession> {
    return this.prisma.whatsAppSession.update({
      where: { id: row.id },
      data: { status: WhatsAppSessionStatus.FAILED, lastError: message.slice(0, 500) },
    });
  }

  private async ensureRow(name: string, actorId?: string): Promise<WhatsAppSession> {
    return this.prisma.whatsAppSession.upsert({
      where: { name },
      create: { name, provider: 'openwa', createdById: actorId },
      update: {},
    });
  }

  private async require(name: string): Promise<WhatsAppSession> {
    const row = await this.prisma.whatsAppSession.findUnique({ where: { name } });
    if (!row) throw new BadRequestException(`No WhatsApp session named "${name}"`);
    return row;
  }

  /**
   * Point the gateway at our callback. The URL is explicit configuration
   * (OPENWA_WEBHOOK_URL) rather than derived — the gateway usually reaches the
   * API on an internal address that no public URL can be guessed from.
   */
  private async registerWebhook(name: string): Promise<void> {
    const url = this.config.get('whatsapp', { infer: true }).openwa.webhookUrl;
    if (!url) {
      this.logger.log('OPENWA_WEBHOOK_URL is not set — skipping webhook registration');
      return;
    }
    await this.client().registerWebhook(url, ['message.received', 'session.status'], name);
  }

  /** The live client from the active channel provider (never a second socket). */
  private client(): OpenWaClient {
    const provider = this.channel.providerInstance;
    if (provider instanceof OpenWaProvider) return provider.gateway;
    // The channel is Meta-backed: build a client from config so an operator can
    // pair a session BEFORE flipping WHATSAPP_PROVIDER to openwa.
    return new OpenWaClient(this.config.get('whatsapp', { infer: true }).openwa);
  }

  private assertOpenWa(): void {
    if (!this.isOpenWa) {
      throw new BadRequestException(
        'Session management requires WHATSAPP_PROVIDER=openwa (the Meta Cloud API has no QR session)',
      );
    }
  }

  private publish(
    name: typeof DomainEventName.WhatsAppSessionConnected | typeof DomainEventName.WhatsAppSessionDisconnected,
    row: WhatsAppSession,
    reason?: string,
  ): void {
    this.events.publish({
      name,
      tenantId: null,
      communityId: null,
      actorId: null,
      entityId: row.id,
      data: { session: row.name, phoneNumber: row.phoneNumber, reason },
    });
  }
}

function toView(row: WhatsAppSession): SessionView {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    status: row.status,
    phoneNumber: row.phoneNumber,
    isDefault: row.isDefault,
    hasApiKey: Boolean(row.apiKeyEnc),
    lastConnectedAt: row.lastConnectedAt,
    lastDisconnectedAt: row.lastDisconnectedAt,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
  };
}
