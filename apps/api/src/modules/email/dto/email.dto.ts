import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SendTestEmailDto {
  @ApiProperty({ example: 'ops@living.local', description: 'Recipient of the test email' })
  @IsEmail()
  to!: string;
}

export class SetProviderDto {
  @ApiProperty({ enum: ['ses', 'smtp'], description: 'Provider to activate at runtime' })
  @IsIn(['ses', 'smtp'])
  provider!: 'ses' | 'smtp';
}

export class StatisticsQueryDto {
  @ApiPropertyOptional({ default: 24, description: 'Trailing window in hours' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720)
  windowHours = 24;
}
