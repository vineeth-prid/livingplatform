import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus, VerificationTokenType } from '@prisma/client';
import * as argon2 from 'argon2';

import type { AppConfig } from '../../config/configuration';

import { expiryFrom } from '../../common/utils/duration';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  ResetPasswordWithOtpDto,
} from './dto/auth.dto';
import { OtpService } from './otp.service';
import { PasswordPolicyService } from './password-policy.service';
import { TokensService, type TokenPair } from './tokens.service';

const EMAIL_VERIFICATION_TTL = '24h';
const PASSWORD_RESET_TTL = '1h';
const GENERIC_MESSAGE = 'If that account exists, we have sent instructions to it';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string | null;
  status: UserStatus;
  emailVerified: boolean;
  mustChangePassword: boolean;
  roles: string[];
}

/**
 * Authentication use-cases. Deliberately thin controllers → this service owns
 * every auth flow (register, verify, login, refresh, reset). Token mechanics
 * live in TokensService; this orchestrates users, verification tokens and mail.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Configurable one-time password for provisioned/reset accounts. */
  private readonly defaultPassword: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly tokens: TokensService,
    private readonly mail: MailService,
    private readonly passwords: PasswordPolicyService,
    private readonly otp: OtpService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.defaultPassword = config.get('auth', { infer: true }).defaultPassword;
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      // Don't reveal registration status; behave like success.
      return { message: 'Check your email to confirm your account' };
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: UserStatus.PENDING,
      },
      select: { id: true, email: true },
    });

    const token = await this.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL,
    );
    await this.mail.sendEmailVerification(user.email, token);

    return { message: 'Check your email to confirm your account' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const userId = await this.consumeVerificationToken(
      token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
    });
    return { message: 'Your email is confirmed. You can sign in now.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) {
      const token = await this.createVerificationToken(
        user.id,
        VerificationTokenType.EMAIL_VERIFICATION,
        EMAIL_VERIFICATION_TTL,
      );
      await this.mail.sendEmailVerification(user.email, token);
    }
    return { message: GENERIC_MESSAGE };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    // Identifier is an email or a mobile number (people accounts log in with
    // their phone as username — digits only, matching normalizePhone at signup).
    const identifier = dto.email.trim();
    const username = identifier.replace(/\D/g, '');
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: identifier.toLowerCase() },
          ...(username.length >= 7 ? [{ username }] : []),
        ],
      },
    });

    // Constant-ish work whether or not the user exists to blunt enumeration:
    // always run a verify against a real-or-dummy hash.
    const hash =
      user?.passwordHash ??
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000';
    const ok = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Please confirm your email to sign in');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const principal = await this.rbac.buildPrincipal({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });
    const pair = await this.tokens.issuePair(
      principal,
      dto.rememberMe ?? false,
      meta,
    );
    return { ...pair, user: this.toPublicUser(user, principal) };
  }

  async refresh(
    refreshToken: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const { pair, principal } = await this.tokens.rotate(
      refreshToken,
      rememberMe,
      meta,
    );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.id },
    });
    return { ...pair, user: this.toPublicUser(user, principal) };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokens.revoke(refreshToken);
    return { message: 'Signed out' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.tokens.revokeAllForUser(userId);
    return { message: 'Signed out of all sessions' };
  }

  /**
   * Start a password reset. The identifier is an email OR a mobile number —
   * mobile is the platform's primary login, so a resident who only knows their
   * phone number can still recover. Mobile accounts get a WhatsApp OTP; email
   * accounts get the existing emailed link. The response is identical either
   * way so the endpoint never confirms whether an account exists.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; channel: 'otp' | 'link' }> {
    const identifier = dto.identifier.trim();
    const username = identifier.replace(/\D/g, '');
    const looksLikeMobile = username.length >= 7 && !identifier.includes('@');

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: identifier.toLowerCase() },
          ...(username.length >= 7 ? [{ username }] : []),
        ],
      },
      select: { id: true, email: true, username: true, firstName: true },
    });

    if (user) {
      if (user.username) {
        await this.otp.issue({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          mobile: user.username,
        });
      } else {
        const token = await this.createVerificationToken(
          user.id,
          VerificationTokenType.PASSWORD_RESET,
          PASSWORD_RESET_TTL,
        );
        await this.mail.sendPasswordReset(user.email, token);
      }
    }
    // Shape the hint off the *identifier*, not off the lookup result.
    return { message: GENERIC_MESSAGE, channel: looksLikeMobile ? 'otp' : 'link' };
  }

  /** Complete a reset from an emailed link token. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.consumeVerificationToken(
      dto.token,
      VerificationTokenType.PASSWORD_RESET,
    );
    return this.applyNewPassword(userId, dto.password);
  }

  /** Complete a reset from a mobile OTP. */
  async resetPasswordWithOtp(dto: ResetPasswordWithOtpDto): Promise<{ message: string }> {
    const username = dto.mobile.replace(/\D/g, '');
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      select: { id: true },
    });
    // Same generic failure whether the number is unknown or the code is wrong.
    if (!user) throw new BadRequestException('That code is invalid or has expired');
    const userId = await this.otp.verify(user.id, dto.code);
    return this.applyNewPassword(userId, dto.password);
  }

  /**
   * Admin-initiated reset: set the account back to the configured one-time
   * password and force a change at next sign-in. Returns the password so the
   * admin can read it out — it is already known platform-wide by design.
   */
  async adminResetPassword(
    userId: string,
    actor: AuthenticatedUser,
    newPassword?: string,
  ): Promise<{ message: string; temporaryPassword: string; mustChangePassword: true }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!user) throw new BadRequestException('User not found');
    // A tenant admin may only reset users inside their own tenant.
    if (actor.tenantId && user.tenantId !== actor.tenantId) {
      throw new BadRequestException('User not found');
    }

    const temporaryPassword = newPassword ?? this.defaultPassword;
    const passwordHash = await this.passwords.hashAndRecord(userId, temporaryPassword).catch(
      // A forced reset must succeed even when the temp password is in history.
      () => this.passwords.hash(temporaryPassword),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, updatedById: actor.id },
    });
    await this.tokens.revokeAllForUser(userId);
    this.logger.log(`Password reset for user=${userId} by admin=${actor.id}`);
    return {
      message: 'Password reset. The user must change it at next sign-in.',
      temporaryPassword,
      mustChangePassword: true,
    };
  }

  /** Shared tail of every reset path: policy check, write, revoke sessions. */
  private async applyNewPassword(userId: string, password: string): Promise<{ message: string }> {
    const passwordHash = await this.passwords.hashAndRecord(userId, password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    // Force re-authentication everywhere after a password change.
    await this.tokens.revokeAllForUser(userId);
    return { message: 'Your password has been reset. Please sign in.' };
  }

  async getProfile(principal: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.id },
    });
    return this.toPublicUser(user, principal);
  }

  /** Signed-in password change — used by the forced first-login flow. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    // Rejects reuse of a recent password and records the old hash in history.
    const passwordHash = await this.passwords.hashAndRecord(userId, newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return { message: 'Your password has been changed.' };
  }

  // ── verification token helpers (selector.verifier, same as refresh) ─────────

  private async createVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttl: string,
  ): Promise<string> {
    // Invalidate any outstanding tokens of the same type first.
    await this.prisma.verificationToken.updateMany({
      where: { userId, type, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const secret = randomBytes(32).toString('base64url');
    const tokenHash = await argon2.hash(secret, { type: argon2.argon2id });
    const row = await this.prisma.verificationToken.create({
      data: { userId, type, tokenHash, expiresAt: expiryFrom(ttl) },
      select: { id: true },
    });
    return `${row.id}.${secret}`;
  }

  private async consumeVerificationToken(
    token: string,
    type: VerificationTokenType,
  ): Promise<string> {
    const idx = token.indexOf('.');
    if (idx <= 0) throw new BadRequestException('Invalid or expired token');
    const id = token.slice(0, idx);
    const secret = token.slice(idx + 1);

    const row = await this.prisma.verificationToken.findUnique({
      where: { id },
    });
    if (
      !row ||
      row.type !== type ||
      row.consumedAt ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }
    const valid = await argon2.verify(row.tokenHash, secret);
    if (!valid) throw new BadRequestException('Invalid or expired token');

    await this.prisma.verificationToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return row.userId;
  }

  private toPublicUser(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      tenantId: string | null;
      status: UserStatus;
      emailVerifiedAt: Date | null;
      mustChangePassword?: boolean;
    },
    principal: AuthenticatedUser,
  ): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      mustChangePassword: user.mustChangePassword ?? false,
      roles: principal.roles.map((r) => r.key),
    };
  }
}
