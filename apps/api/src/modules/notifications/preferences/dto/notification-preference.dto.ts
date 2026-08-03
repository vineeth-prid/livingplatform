import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationEvent } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { NOTIFICATION_CHANNELS } from '../../notification.constants';

export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional({ description: 'Send this notification at all' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;
}

export class UpsertNotificationTemplateDto {
  @ApiProperty({ enum: NotificationEvent })
  @IsEnum(NotificationEvent)
  event!: NotificationEvent;

  @ApiProperty({ enum: NOTIFICATION_CHANNELS })
  @IsIn([...NOTIFICATION_CHANNELS])
  channel!: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({ description: 'Email subject (ignored by text-only channels)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    description: 'Message body. Handlebars variables, e.g. {{residentName}}, {{amount}}.',
  })
  @IsString()
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
