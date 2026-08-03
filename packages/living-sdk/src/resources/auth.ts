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

  /**
   * Start a reset. `identifier` is an email OR a mobile number — mobile users
   * get a WhatsApp OTP, email users get a link. `channel` tells the UI which
   * screen to show next without leaking whether the account exists.
   */
  forgotPassword(identifier: string): Promise<{ message: string; channel: 'otp' | 'link' }> {
    return this.http.request('POST', '/auth/forgot-password', {
      body: { identifier },
      skipAuth: true,
    });
  }

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/reset-password', { body: { token, password }, skipAuth: true });
  }

  /** Complete a mobile reset with the OTP that was sent to the number. */
  resetPasswordWithOtp(mobile: string, code: string, password: string): Promise<{ message: string }> {
    return this.http.request('POST', '/auth/reset-password-otp', {
      body: { mobile, code, password },
      skipAuth: true,
    });
  }

  /** Admin reset — returns the temporary password to read out to the user. */
  adminResetPassword(
    userId: string,
    password?: string,
  ): Promise<{ message: string; temporaryPassword: string; mustChangePassword: true }> {
    return this.http.post(`/auth/users/${userId}/reset-password`, password ? { password } : {});
  }

  me(): Promise<PublicUser> {
    return this.http.get('/auth/me');
  }

  changePassword(currentPassword: string, password: string): Promise<{ message: string }> {
    return this.http.post('/auth/change-password', { currentPassword, password });
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
