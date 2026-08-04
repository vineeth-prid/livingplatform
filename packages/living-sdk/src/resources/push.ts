import type { HttpClient } from '../http';

export interface PushDevice {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

/** Web Push device registration. Self-service — always the caller's own devices. */
export class PushResource {
  constructor(private readonly http: HttpClient) {}

  /** VAPID public key + whether the server has push configured at all. */
  publicKey(): Promise<{ publicKey: string | null; enabled: boolean }> {
    return this.http.get('/push/public-key');
  }

  subscribe(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<{ id: string; registered: true }> {
    return this.http.post('/push/subscriptions', input);
  }

  devices(): Promise<PushDevice[]> {
    return this.http.get('/push/subscriptions');
  }

  unsubscribe(endpoint: string): Promise<{ deleted: number }> {
    return this.http.delete(`/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`);
  }
}
