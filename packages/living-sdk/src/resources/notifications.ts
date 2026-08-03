import type { HttpClient } from '../http';
import type { Paginated } from '@living/types';

export type EmailProviderName = 'ses' | 'smtp';
export type NotificationChannelName = 'email' | 'whatsapp';

export interface EmailProviderInfo {
  active: EmailProviderName;
  configured: EmailProviderName;
  overridden: boolean;
  supported: EmailProviderName[];
}

export interface ChannelHealth {
  state: 'healthy' | 'unhealthy';
  channel?: NotificationChannelName;
  provider: string;
  reason?: string;
  latencyMs?: number;
}

export interface ChannelInfo {
  channel: NotificationChannelName;
  provider: string;
  health: ChannelHealth | null;
}

export interface TestResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
}

export interface NotificationStatistics {
  channel: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deadLettered: number;
  queued: number;
  processing: number;
  retrying: number;
  queue: { waiting: number; active: number; delayed: number; failed: number; completed: number };
  averageDeliveryMs: number;
  providerLatencyMs: number;
  totalRetries: number;
  byChannel: { channel: string; sent: number; failed: number; delivered: number }[];
  byProvider: { provider: string; sent: number; failed: number }[];
  bounces: number;
  complaints: number;
  windowHours: number;
}

export interface NotificationDeliveryRow {
  id: string;
  channel: string;
  provider: string;
  recipients: string[];
  subject: string;
  template: string | null;
  status: string;
  retryCount: number;
  providerMessageId: string | null;
  durationMs: number | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

/** Email-channel admin controls (routes preserved from the Email sprint). */
export class EmailAdminResource {
  constructor(private readonly http: HttpClient) {}
  provider(): Promise<EmailProviderInfo> {
    return this.http.get('/notifications/email/provider');
  }
  setProvider(provider: EmailProviderName): Promise<Omit<EmailProviderInfo, 'supported'>> {
    return this.http.put('/notifications/email/provider', { provider });
  }
  health(): Promise<ChannelHealth> {
    return this.http.get('/notifications/email/health');
  }
  test(to: string): Promise<TestResult> {
    return this.http.post('/notifications/email/test', { to });
  }
  statistics(windowHours = 24): Promise<NotificationStatistics> {
    return this.http.get('/notifications/email/statistics', { windowHours });
  }
}

export type WhatsAppSessionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_PENDING'
  | 'CONNECTED'
  | 'FAILED';

export interface WhatsAppSession {
  id: string;
  name: string;
  provider: string;
  status: WhatsAppSessionStatus;
  phoneNumber: string | null;
  isDefault: boolean;
  hasApiKey: boolean;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface WhatsAppSettings {
  provider: string;
  supported: string[];
  rateLimitPerMinute: number;
  defaultSender: string;
  openwa: {
    baseUrl: string;
    session: string;
    autoReconnect: boolean;
    healthIntervalSec: number;
    webhookConfigured: boolean;
    webhookUrl: string | null;
  };
}

/** WhatsApp-channel admin controls, including the OpenWA connection manager. */
export class WhatsAppAdminResource {
  constructor(private readonly http: HttpClient) {}
  health(): Promise<ChannelHealth> {
    return this.http.get('/notifications/whatsapp/health');
  }
  test(to: string): Promise<TestResult> {
    return this.http.post('/notifications/whatsapp/test', { to });
  }
  statistics(windowHours = 24): Promise<NotificationStatistics> {
    return this.http.get('/notifications/whatsapp/statistics', { windowHours });
  }

  // ── Gateway configuration + sessions (Platform Admin) ──
  settings(): Promise<WhatsAppSettings> {
    return this.http.get('/notifications/whatsapp/settings');
  }
  sessions(): Promise<WhatsAppSession[]> {
    return this.http.get('/notifications/whatsapp/sessions');
  }
  session(name: string): Promise<WhatsAppSession & { reachable: boolean }> {
    return this.http.get(`/notifications/whatsapp/sessions/${encodeURIComponent(name)}`);
  }
  qr(name: string): Promise<{ qr: string | null; dataUrl: string | null; status: WhatsAppSessionStatus }> {
    return this.http.get(`/notifications/whatsapp/sessions/${encodeURIComponent(name)}/qr`);
  }
  connect(name: string): Promise<WhatsAppSession> {
    return this.http.post(`/notifications/whatsapp/sessions/${encodeURIComponent(name)}/connect`, {});
  }
  reconnect(name: string): Promise<WhatsAppSession> {
    return this.http.post(`/notifications/whatsapp/sessions/${encodeURIComponent(name)}/reconnect`, {});
  }
  disconnect(name: string): Promise<WhatsAppSession> {
    return this.http.post(`/notifications/whatsapp/sessions/${encodeURIComponent(name)}/disconnect`, {});
  }
  setApiKey(name: string, apiKey: string): Promise<WhatsAppSession> {
    return this.http.put(`/notifications/whatsapp/sessions/${encodeURIComponent(name)}/api-key`, { apiKey });
  }
}

export type NotificationEventKey =
  | 'MAINTENANCE_DUE' | 'PAYMENT_SUCCESS' | 'PAYMENT_CONFIRMATION' | 'VISITOR_PASS'
  | 'VISITOR_APPROVED' | 'BOOKING_CONFIRMED' | 'ANNOUNCEMENT' | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED' | 'TICKET_UPDATE' | 'SERVICE_ASSIGNED' | 'SERVICE_UPDATE'
  | 'WORK_ORDER_ASSIGNED' | 'WORK_ORDER_UPDATE' | 'PASSWORD_RESET' | 'WELCOME';

export interface NotificationPreference {
  event: NotificationEventKey;
  enabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  configured: boolean;
}

export interface CommunityNotificationTemplate {
  id: string;
  communityId: string;
  event: NotificationEventKey;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  enabled: boolean;
}

/** Community Admin: routing and message wording. Configuration only — no sends. */
export class NotificationPreferencesResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string): Promise<NotificationPreference[]> {
    return this.http.get(`/communities/${communityId}/notification-preferences`);
  }
  update(
    communityId: string,
    event: NotificationEventKey,
    input: { enabled?: boolean; emailEnabled?: boolean; whatsappEnabled?: boolean },
  ): Promise<NotificationPreference> {
    return this.http.put(`/communities/${communityId}/notification-preferences/${event}`, input);
  }

  templates(communityId: string): Promise<CommunityNotificationTemplate[]> {
    return this.http.get(`/communities/${communityId}/notification-templates`);
  }
  saveTemplate(
    communityId: string,
    input: {
      event: NotificationEventKey;
      channel: string;
      body: string;
      subject?: string;
      locale?: string;
      enabled?: boolean;
    },
  ): Promise<CommunityNotificationTemplate> {
    return this.http.post(`/communities/${communityId}/notification-templates`, input);
  }
  deleteTemplate(communityId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/communities/${communityId}/notification-templates/${id}`);
  }
}

/** Notification Engine — one engine, many channels. */
export class NotificationsResource {
  readonly email: EmailAdminResource;
  readonly whatsapp: WhatsAppAdminResource;
  readonly preferences: NotificationPreferencesResource;
  constructor(private readonly http: HttpClient) {
    this.email = new EmailAdminResource(http);
    this.whatsapp = new WhatsAppAdminResource(http);
    this.preferences = new NotificationPreferencesResource(http);
  }

  /** Shared queue depth across every channel. */
  queue(): Promise<{
    waiting: number; active: number; delayed: number; failed: number; completed: number;
    retrying: number; deadLettered: number;
  }> {
    return this.http.get('/notifications/queue');
  }

  /** Platform default templates available to every community. */
  templates(): Promise<Array<{ name: string; source: 'platform' }>> {
    return this.http.get('/notifications/templates');
  }

  channels(): Promise<ChannelInfo[]> {
    return this.http.get('/notifications/channels');
  }
  statistics(windowHours = 24, channel?: string): Promise<NotificationStatistics> {
    return this.http.get('/notifications/statistics', { windowHours, ...(channel ? { channel } : {}) });
  }
  deliveries(params?: { page?: number; limit?: number; channel?: string; status?: string; search?: string }): Promise<Paginated<NotificationDeliveryRow>> {
    return this.http.get('/notifications/deliveries', params);
  }
}
