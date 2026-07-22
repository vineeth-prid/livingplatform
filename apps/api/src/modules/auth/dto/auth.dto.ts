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
  @ApiProperty({ example: 'admin@living.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Living!2024' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ default: false, description: 'Extend refresh lifetime' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
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
  @ApiProperty({ example: 'admin@living.local' })
  @IsEmail()
  email!: string;
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
