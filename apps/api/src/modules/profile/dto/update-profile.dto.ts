import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThemePreference } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) bio?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional() @IsString() @MaxLength(12)
  language?: string;

  @ApiPropertyOptional({ enum: ThemePreference })
  @IsOptional() @IsEnum(ThemePreference)
  theme?: ThemePreference;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional() @IsString() @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: '{ channels: { email, sms, push, whatsapp }, … }' })
  @IsOptional()
  notificationPreferences?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  twoFactorEnabled?: boolean;
}
