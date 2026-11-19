import {
  Body,
  Controller,
  NotFoundException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowRestrictedSession } from '../../common/guards/restricted-session.guard';
import { Public } from '../../common/decorators/public.decorator';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  AdminResetPasswordDto,
  ChangePasswordDto,
  DisableMfaDto,
  ForgotPasswordDto,
  LoginDto,
  MfaCodeDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  ResetPasswordWithOtpDto,
  VerifyEmailDto,
} from './dto/auth.dto';

function meta(req: Request) {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new account (sends a verification email)' })
  register(@Body() dto: RegisterDto) {
    // Accounts are provisioned by communities; open sign-up is off in
    // production unless AUTH_SELF_REGISTRATION=true (no app uses it today).
    if (!this.config.get('auth', { infer: true }).selfRegistration) {
      throw new NotFoundException();
    }
    return this.auth.register(dto);
  }

  @Public()
  @Post('verify-email')
  // Each attempt costs an argon2 verify; cap it like the other public auth routes.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address with a token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification link' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, dto.rememberMe ?? false, meta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token (sign out this session)' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @AllowRestrictedSession()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every refresh token for the current user' })
  logoutAll(@CurrentUser('id') userId: string) {
    return this.auth.logoutAll(userId);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a password reset by email or mobile number (OTP for mobile)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('reset-password-otp')
  // Tighter than the link flow: a 6-digit code is guessable if you let someone
  // try often enough (the OTP itself also burns after 5 wrong attempts).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using the mobile OTP' })
  resetPasswordWithOtp(@Body() dto: ResetPasswordWithOtpDto) {
    return this.auth.resetPasswordWithOtp(dto);
  }

  @Post('users/:userId/reset-password')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin reset — sets a temporary password and forces a change at next sign-in',
  })
  adminResetPassword(
    @Param('userId') userId: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auth.adminResetPassword(userId, user, dto.password);
  }

  @Post('change-password')
  @AllowRestrictedSession()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change the current user’s password — signs out other sessions and returns a fresh token pair',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(userId, dto.currentPassword, dto.password, meta(req));
  }

  // ── Two-factor sign-in (TOTP authenticator app) ──

  @Post('mfa/setup')
  @AllowRestrictedSession()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start two-factor enrolment — returns the secret and otpauth:// URL' })
  startMfa(@CurrentUser('id') userId: string) {
    return this.auth.startMfaSetup(userId);
  }

  @Post('mfa/enable')
  @AllowRestrictedSession()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm enrolment with the first code (returns a fresh token pair)' })
  enableMfa(@CurrentUser('id') userId: string, @Body() dto: MfaCodeDto, @Req() req: Request) {
    return this.auth.confirmMfaSetup(userId, dto.code, meta(req));
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Turn two-factor off (password + current code)' })
  disableMfa(@CurrentUser('id') userId: string, @Body() dto: DisableMfaDto) {
    return this.auth.disableMfa(userId, dto.password, dto.code);
  }

  @Get('me')
  @AllowRestrictedSession()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user);
  }
}
