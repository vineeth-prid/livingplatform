import { LivingApiError } from './errors';
import type { StoredTokens, TokenStore } from './token-store';

export interface HttpClientOptions {
  /** e.g. http://localhost:4000/api/v1 */
  baseUrl: string;
  tokenStore: TokenStore;
  /** Called when a refresh fails — the app redirects to login. */
  onUnauthorized?: () => void;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  skipAuth?: boolean;
  _retried?: boolean;
}

/**
 * The single place any network call happens. Adds the bearer token, transparently
 * refreshes on 401 (single-flight, retries once), unwraps the `{ success, data }`
 * envelope, and normalizes errors to LivingApiError. Components NEVER call fetch —
 * they go through the typed resources built on this.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly tokenStore: TokenStore;
  private readonly onUnauthorized?: () => void;
  private refreshing: Promise<boolean> | null = null;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.tokenStore = opts.tokenStore;
    this.onUnauthorized = opts.onUnauthorized;
  }

  get<T>(path: string, query?: Record<string, unknown>) {
    return this.request<T>('GET', path, { query });
  }
  post<T>(path: string, body?: unknown, query?: Record<string, unknown>) {
    return this.request<T>('POST', path, { body, query });
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, { body });
  }
  delete<T>(path: string) {
    return this.request<T>('DELETE', path, {});
  }

  /** Public because auth uses it directly (skipAuth for login/register/refresh). */
  async request<T>(method: Method, path: string, options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!options.skipAuth) {
      const token = this.tokenStore.getAccess();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(this.buildUrl(path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401 && !options.skipAuth && !options._retried) {
      const refreshed = await this.tryRefresh();
      if (refreshed) return this.request<T>(method, path, { ...options, _retried: true });
      this.onUnauthorized?.();
    }

    return this.parse<T>(res);
  }

  setTokens(tokens: StoredTokens): void {
    this.tokenStore.set(tokens);
  }
  clearTokens(): void {
    this.tokenStore.clear();
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw LivingApiError.fromBody(res.status, json);
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return (json as { data: T }).data;
    }
    return json as T;
  }

  private tryRefresh(): Promise<boolean> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = this.tokenStore.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(this.buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        this.tokenStore.clear();
        return false;
      }
      const json = (await res.json()) as { data?: StoredTokens } & Partial<StoredTokens>;
      const data = json.data ?? (json as StoredTokens);
      this.tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  }
}
