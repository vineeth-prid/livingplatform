import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** One slide in the resident home hero carousel. */
export class HomeBannerDto {
  @ApiProperty({ description: 'Stable id — used as the React key and for ordering' })
  @IsString() @MaxLength(64)
  id!: string;

  @ApiProperty()
  @IsString() @MaxLength(120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  subtitle?: string;

  @ApiPropertyOptional({ description: 'Storage key resolved through StorageService — never a raw URL' })
  @IsOptional() @IsString() @MaxLength(300)
  imageKey?: string;

  @ApiPropertyOptional({ description: 'In-app route the slide opens, e.g. /services' })
  @IsOptional() @IsString() @MaxLength(300)
  actionUrl?: string;

  @ApiPropertyOptional({ enum: ['announcement', 'ad'], default: 'ad' })
  @IsOptional() @IsIn(['announcement', 'ad'])
  kind?: 'announcement' | 'ad';

  @ApiPropertyOptional()
  @IsOptional() @IsInt()
  sortOrder?: number;
}

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

  // ── Module toggles ──
  @ApiPropertyOptional({
    description:
      'Whether Living collects maintenance charges for this community. OFF disables ' +
      'invoice generation, maintenance payments and every maintenance surface.',
  })
  @IsOptional() @IsBoolean() maintenanceBillingEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether residents can browse and buy Service Packages.' })
  @IsOptional() @IsBoolean() servicePackagesEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Rotating hero banners on the resident home. Each: { id, title, subtitle?, ' +
      'imageKey?, actionUrl?, kind: "announcement" | "ad", sortOrder? }.',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HomeBannerDto)
  homeBanners?: HomeBannerDto[];

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
