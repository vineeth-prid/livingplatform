import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SendTestEmailDto {
  @ApiProperty({ example: 'ops@living.local' })
  @IsEmail()
  to!: string;
}

export class SendTestWhatsAppDto {
  @ApiProperty({ example: '+919876543210', description: 'Recipient phone (E.164 or local)' })
  @IsString()
  to!: string;
}

export class SetProviderDto {
  @ApiProperty({ enum: ['ses', 'smtp'], description: 'Email provider to activate at runtime' })
  @IsIn(['ses', 'smtp'])
  provider!: 'ses' | 'smtp';
}

export class StatisticsQueryDto {
  @ApiPropertyOptional({ default: 24, description: 'Trailing window in hours' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720)
  windowHours = 24;

  @ApiPropertyOptional({ description: 'Scope to a single channel' })
  @IsOptional() @IsString()
  channel?: string;
}

export class DeliveriesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 25;

  @ApiPropertyOptional() @IsOptional() @IsString() channel?: string;

  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional() @IsEnum(NotificationStatus) status?: NotificationStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
