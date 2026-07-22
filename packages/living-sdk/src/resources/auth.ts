import type { AuthResult, LoginInput, PublicUser, RegisterInput } from '@living/types';

import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';

/** Authentication flows. `login`/`refresh` set tokens on the client automatically. */
export class AuthResource {
  constructor(
    private readonly http: HttpClient,
    private readonly tokenStore: TokenStore,
  ) {}

  async login(input: LoginInput): Promise<AuthResult> {
    const result = await this.http.request<AuthResult>('POST', '/auth/login', {
      body: input,
      skipAuth: true,
    });
    this.http.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  }

  register(input: RegisterInput): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/register', { body: input, skipAuth: true });
  }

  verifyEmail(token: string): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/verify-email', { body: { token }, skipAuth: true });
  }

  resendVerification(email: string): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/resend-verification', { body: { email }, skipAuth: true });
  }

  forgotPassword(email: string): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/forgot-password', { body: { email }, skipAuth: true });
  }

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/reset-password', { body: { token, password }, skipAuth: true });
  }

  me(): Promise<PublicUser> {
    return this.http.get('/auth/me');
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokenStore.getRefresh();
    try {
      if (refreshToken) {
        await this.http.request('POST', '/auth/logout', { body: { refreshToken }, skipAuth: true });
      }
    } finally {
      this.http.clearTokens();
    }
  }

  logoutAll(): Promise<{ message: string }> {
    return this.http.post('/auth/logout-all');
  }
}
