import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus, VerificationTokenType } from '@prisma/client';
import * as argon2 from 'argon2';

import { SecretCipher } from '../../common/crypto/secret-cipher';
import { expiryFrom } from '../../common/utils/duration';
import { AuditService } from '../audit/audit.service';
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
import { SessionSecurityService } from './session-security.service';
import { generateTemporaryPassword } from './temporary-password';
import { TokensService, type TokenPair } from './tokens.service';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

/**
 * 401 the sign-in screens recognise (by `error`) to ask for the authenticator
 * code. Only thrown AFTER the password checks out, so it reveals nothing.
 */
export class MfaRequiredException extends UnauthorizedException {
  constructor() {
    super('Enter the 6-digit code from your authenticator app');
  }
}

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
  mfaEnabled: boolean;
  /** Two-factor enrolment is required for this account's role and not done yet. */
  mfaSetupRequired: boolean;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly tokens: TokensService,
    private readonly mail: MailService,
    private readonly passwords: PasswordPolicyService,
    private readonly otp: OtpService,
    private readonly sessions: SessionSecurityService,
    private readonly cipher: SecretCipher,
    private readonly audit: AuditService,
  ) {}

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
    // Per-account lockout (keyed on what was typed, so unknown and known
    // accounts behave the same) — the IP throttle alone does not stop a botnet.
    await this.sessions.assertNotLocked(identifier);
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
      await this.loginFailed(identifier, meta, user?.id ?? null, 'bad_password');
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Please confirm your email to sign in');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active');
    }

    // Two-factor: only asked for once the password is right.
    if (user.mfaEnabledAt && user.mfaSecret) {
      if (!dto.mfaCode) throw new MfaRequiredException();
      if (!(await this.checkTotp(user.id, user.mfaSecret, dto.mfaCode))) {
        await this.loginFailed(identifier, meta, user.id, 'bad_mfa_code');
        throw new UnauthorizedException('That two-factor code is not valid');
      }
    }
    await this.sessions.clearFailures(identifier);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const principal = this.tokens.withRestrictions(
      await this.rbac.buildPrincipal({
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
      }),
      user,
    );
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
    const user = await this.findByIdentifier(identifier);

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

    /*
      `channel` has to describe what was actually SENT, not what the identifier
      looked like.

      Shaping it off the identifier meant a staff member who typed their EMAIL
      was told "a link is on its way" while the engine — seeing an account with
      a mobile number — sent a one-time code instead. The code arrived, the app
      showed the link screen, and there was nowhere to enter it. Anyone
      provisioned with a phone-number login (all staff, vendors and residents)
      hit this the moment they recovered by email.

      Falling back to the identifier's shape when no account matches keeps the
      endpoint from confirming whether one exists.
    */
    const looksLikeMobile =
      identifier.replace(/\D/g, '').length >= 7 && !identifier.includes('@');
    const channel = user ? (user.username ? 'otp' : 'link') : looksLikeMobile ? 'otp' : 'link';
    return { message: GENERIC_MESSAGE, channel };
  }

  /**
   * Resolve an account from what a person typed to sign in: an email address or
   * the digits-only mobile username. One lookup, shared by the reset flows, so
   * they can never disagree about which account a reset is for.
   */
  private findByIdentifier(identifier: string) {
    const username = identifier.replace(/\D/g, '');
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: identifier.toLowerCase() },
          ...(username.length >= 7 ? [{ username }] : []),
        ],
      },
      select: { id: true, email: true, username: true, firstName: true },
    });
  }

  /** Complete a reset from an emailed link token. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.consumeVerificationToken(
      dto.token,
      VerificationTokenType.PASSWORD_RESET,
    );
    return this.applyNewPassword(userId, dto.password);
  }

  /** Complete a reset from the OTP, found by the same identifier that asked for it. */
  async resetPasswordWithOtp(dto: ResetPasswordWithOtpDto): Promise<{ message: string }> {
    const user = await this.findByIdentifier(dto.identifier.trim());
    // Same generic failure whether the account is unknown or the code is wrong.
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

    // A fresh random value per reset — never a shared, published default.
    const temporaryPassword = newPassword ?? generateTemporaryPassword();
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
  /**
   * Change the signed-in user's password. Every OTHER session is signed out
   * (a thief holding an old refresh token loses it), and this device gets a
   * fresh token pair — which is also what lifts a one-time-password session's
   * restriction without a second sign-in.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta = {},
  ): Promise<{ message: string } & AuthResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    // Rejects reuse of a recent password and records the old hash in history.
    const passwordHash = await this.passwords.hashAndRecord(userId, newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.tokens.revokeAllForUser(userId);
    const result = await this.reissue(updated, meta);
    return { message: 'Your password has been changed.', ...result };
  }

  // ── two-factor sign-in (TOTP) ──────────────────────────────────────────────

  /** Start enrolment: a new secret, stored encrypted, NOT active until confirmed. */
  async startMfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabledAt) throw new BadRequestException('Two-factor sign-in is already on');
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: this.cipher.encrypt(secret) },
    });
    return { secret, otpauthUrl: otpauthUri(secret, user.email) };
  }

  /** Confirm enrolment with the first code; returns a fresh, unrestricted session. */
  async confirmMfaSetup(
    userId: string,
    code: string,
    meta: RequestMeta = {},
  ): Promise<{ message: string } & AuthResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabledAt) throw new BadRequestException('Two-factor sign-in is already on');
    if (!user.mfaSecret) throw new BadRequestException('Start two-factor setup first');
    if (!(await this.checkTotp(userId, user.mfaSecret, code))) {
      throw new BadRequestException('That code is not valid — check the time on your phone and try again');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabledAt: new Date() },
    });
    void this.audit.record({
      action: 'auth.mfa_enabled', resource: 'auth', actorId: userId, actorEmail: user.email, tenantId: user.tenantId,
    });
    const result = await this.reissue(updated, meta);
    return { message: 'Two-factor sign-in is on.', ...result };
  }

  async disableMfa(userId: string, password: string, code: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabledAt || !user.mfaSecret) throw new BadRequestException('Two-factor sign-in is not on');
    const principal = this.tokens.withRestrictions(
      await this.rbac.buildPrincipal({ id: user.id, email: user.email, tenantId: user.tenantId }),
      { mustChangePassword: false, mfaEnabledAt: null },
    );
    if (principal.mfaSetupRequired) {
      throw new ForbiddenException('Two-factor sign-in is required for your role and cannot be turned off');
    }
    const ok =
      (await this.passwords.verify(user.passwordHash, password)) &&
      (await this.checkTotp(userId, user.mfaSecret, code));
    if (!ok) throw new BadRequestException('Password or code is incorrect');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: null, mfaEnabledAt: null } });
    void this.audit.record({
      action: 'auth.mfa_disabled', resource: 'auth', actorId: userId, actorEmail: user.email, tenantId: user.tenantId,
    });
    return { message: 'Two-factor sign-in is off.' };
  }

  /** Verify a TOTP code against the stored (encrypted) secret; each code works once. */
  private async checkTotp(userId: string, encryptedSecret: string, code: string): Promise<boolean> {
    const step = verifyTotp(this.cipher.decrypt(encryptedSecret), code);
    return step !== null && (await this.sessions.claimTotpStep(userId, step));
  }

  /** Mint a new pair for a user whose security state just changed. */
  private async reissue(
    user: {
      id: string; email: string; firstName: string; lastName: string; tenantId: string | null;
      status: UserStatus; emailVerifiedAt: Date | null; mustChangePassword: boolean; mfaEnabledAt: Date | null;
    },
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const principal = this.tokens.withRestrictions(
      await this.rbac.buildPrincipal({ id: user.id, email: user.email, tenantId: user.tenantId }),
      user,
    );
    const pair = await this.tokens.issuePair(principal, false, meta);
    return { ...pair, user: this.toPublicUser(user, principal) };
  }

  /** Count a failed sign-in toward the lockout and leave a security trail. */
  private async loginFailed(
    identifier: string,
    meta: RequestMeta,
    userId: string | null,
    reason: string,
  ): Promise<void> {
    const failures = await this.sessions.recordFailure(identifier);
    this.logger.warn(`Failed sign-in (${reason}) user=${userId ?? 'unknown'} ip=${meta.ipAddress ?? '?'} count=${failures}`);
    // Only known accounts go to the audit trail — logging every typed
    // identifier would store passwords pasted into the username box.
    if (userId) {
      void this.audit.record({
        action: 'auth.login_failed',
        resource: 'auth',
        resourceId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason, failures },
      });
    }
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
      mfaEnabledAt?: Date | null;
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
      mfaEnabled: !!user.mfaEnabledAt,
      mfaSetupRequired: principal.mfaSetupRequired ?? false,
      roles: principal.roles.map((r) => r.key),
    };
  }
}
