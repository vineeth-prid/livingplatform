import type { HttpClient } from '../http';

export type EmailProviderName = 'ses' | 'smtp';

export interface EmailProviderInfo {
  active: EmailProviderName;
  configured: EmailProviderName;
  overridden: boolean;
  supported: EmailProviderName[];
}

export interface EmailHealth {
  state: 'healthy' | 'unhealthy';
  provider: string;
  reason?: string;
  latencyMs?: number;
}

export interface EmailTestResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
}

export interface EmailStatistics {
  sent: number;
  failed: number;
  deadLettered: number;
  queued: number;
  processing: number;
  retrying: number;
  queue: { waiting: number; active: number; delayed: number; failed: number; completed: number };
  averageDeliveryMs: number;
  providerLatencyMs: number;
  totalRetries: number;
  byProvider: { provider: string; sent: number; failed: number }[];
  bounces: number;
  complaints: number;
  windowHours: number;
}

/** Platform-Admin controls for the Notification Engine's Email Service. */
export class EmailAdminResource {
  constructor(private readonly http: HttpClient) {}

  provider(): Promise<EmailProviderInfo> {
    return this.http.get('/notifications/email/provider');
  }
  setProvider(provider: EmailProviderName): Promise<Omit<EmailProviderInfo, 'supported'>> {
    return this.http.put('/notifications/email/provider', { provider });
  }
  health(): Promise<EmailHealth> {
    return this.http.get('/notifications/email/health');
  }
  test(to: string): Promise<EmailTestResult> {
    return this.http.post('/notifications/email/test', { to });
  }
  statistics(windowHours = 24): Promise<EmailStatistics> {
    return this.http.get('/notifications/email/statistics', { windowHours });
  }
}

/** Notification Engine resources. `notifications.email.*` today; more channels later. */
export class NotificationsResource {
  readonly email: EmailAdminResource;
  constructor(http: HttpClient) {
    this.email = new EmailAdminResource(http);
  }
}
