import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus, VerificationTokenType } from '@prisma/client';
import * as argon2 from 'argon2';

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
} from './dto/auth.dto';
import { TokensService, type TokenPair } from './tokens.service';

const EMAIL_VERIFICATION_TTL = '24h';
const PASSWORD_RESET_TTL = '1h';
const GENERIC_MESSAGE = 'If that email exists, we have sent instructions to it';

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
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      select: { id: true, email: true },
    });
    if (user) {
      const token = await this.createVerificationToken(
        user.id,
        VerificationTokenType.PASSWORD_RESET,
        PASSWORD_RESET_TTL,
      );
      await this.mail.sendPasswordReset(user.email, token);
    }
    return { message: GENERIC_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.consumeVerificationToken(
      dto.token,
      VerificationTokenType.PASSWORD_RESET,
    );
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
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
      roles: principal.roles.map((r) => r.key),
    };
  }
}
