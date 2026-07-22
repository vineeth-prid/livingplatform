import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString } from 'class-validator';

/**
 * Community settings are a single upsertable document. Structured config lives
 * in JSON columns; a few typed toggles/colors the UI binds directly.
 */
export class UpdateCommunitySettingsDto {
  @ApiPropertyOptional({ description: '{ mon: { open, close, closed }, … }' })
  @IsOptional()
  workingHours?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Scheduled maintenance windows' })
  @IsOptional()
  maintenanceWindows?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Support desks / helplines' })
  @IsOptional()
  supportContacts?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '#234B39' })
  @IsOptional() @IsString() @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#B96A43' })
  @IsOptional() @IsString() @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() smsEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() whatsappEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Pet policy (structured)' })
  @IsOptional()
  petPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Parking policy (structured)' })
  @IsOptional()
  parkingPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Escape hatch for tenant-specific settings' })
  @IsOptional()
  customSettings?: Record<string, unknown>;
}
