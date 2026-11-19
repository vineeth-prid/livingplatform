import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Password policy: ≥ 8 chars with at least one letter and one number.
const PASSWORD_MIN = 8;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include a letter and a number';

class PasswordField {
  @ApiProperty({ minLength: PASSWORD_MIN, example: 'Living!2024' })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: 'At least 8 characters' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class RegisterDto extends PasswordField {
  @ApiProperty({ example: 'jordan@living.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jordan' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Rivera' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@living.local', description: 'Email or mobile number' })
  @IsString()
  @MinLength(1)
  email!: string;

  @ApiProperty({ example: 'Living!2024' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ default: false, description: 'Extend refresh lifetime' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @ApiPropertyOptional({ description: 'Six-digit authenticator code, when two-factor sign-in is on' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  mfaCode?: string;
}

/** Confirms two-factor enrolment with the first code from the authenticator app. */
export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code!: string;
}

/** Turning two-factor OFF needs both the password and a current code. */
export class DisableMfaDto extends MfaCodeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class ChangePasswordDto extends PasswordField {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  refreshToken!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Email address OR mobile number — mobile is the primary login',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  identifier!: string;
}

/**
 * Complete an OTP reset: the identifier the code was requested with, the code,
 * and the new password.
 *
 * `identifier`, not `mobile`: the code is issued to any account that HAS a
 * mobile number, including one whose owner asked for it by EMAIL. Accepting
 * only digits here is what stranded a staff member holding a valid OTP — the
 * code arrived, and this endpoint could not find them by the address they had
 * typed, so every attempt came back "invalid or expired".
 */
export class ResetPasswordWithOtpDto extends PasswordField {
  @ApiProperty({
    example: '9876543210',
    description: 'The same email or mobile number the code was requested with',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  identifier!: string;

  @ApiProperty({ example: '482913', description: 'The one-time code sent to the mobile' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code!: string;
}

/** Admin-initiated reset. Omit the password to get a freshly generated one-time password. */
export class AdminResetPasswordDto {
  @ApiPropertyOptional({
    description: 'Temporary password to set. Omitted → a random one-time password is generated.',
  })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password?: string;
}

export class ResetPasswordDto extends PasswordField {
  @ApiProperty({ description: 'Token from the reset email' })
  @IsString()
  @MinLength(1)
  token!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the verification email' })
  @IsString()
  @MinLength(1)
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'jordan@living.local' })
  @IsEmail()
  email!: string;
}
