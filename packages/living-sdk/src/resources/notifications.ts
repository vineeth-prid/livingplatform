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

/** WhatsApp-channel admin controls. */
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
}

/** Notification Engine — one engine, many channels. */
export class NotificationsResource {
  readonly email: EmailAdminResource;
  readonly whatsapp: WhatsAppAdminResource;
  constructor(private readonly http: HttpClient) {
    this.email = new EmailAdminResource(http);
    this.whatsapp = new WhatsAppAdminResource(http);
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
