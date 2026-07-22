import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommunityStatus, CommunityType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EmergencyContactDto {
  @ApiProperty({ example: 'Security Desk' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Security' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @ApiProperty({ example: '+91 98765 43210' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;
}

export class CreateCommunityDto {
  @ApiPropertyOptional({
    description:
      'Target tenant. Required only when a Platform Admin creates a community; ' +
      'ignored for tenant-scoped callers (their own tenant is used).',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ example: 'The Arbour' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'ARB', description: 'Admin code, unique within the tenant' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  code!: string;

  @ApiPropertyOptional({ description: 'URL slug; derived from name when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: CommunityType, default: CommunityType.APARTMENT })
  @IsEnum(CommunityType)
  type!: CommunityType;

  @ApiPropertyOptional({ enum: CommunityStatus })
  @IsOptional()
  @IsEnum(CommunityStatus)
  status?: CommunityStatus;

  // ── Location ──
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) pincode?: string;

  @ApiPropertyOptional({ example: 12.9716 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.5946 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  // ── Branding (storage keys) ──
  @ApiPropertyOptional() @IsOptional() @IsString() logoKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverImageKey?: string;

  // ── Contact ──
  @ApiPropertyOptional() @IsOptional() @IsEmail() contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) website?: string;

  @ApiPropertyOptional({ type: [EmergencyContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];

  // ── Builder / association ──
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) builderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) associationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) registrationNumber?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  goLiveDate?: Date;

  @ApiPropertyOptional({ description: 'Future-ready metadata bag' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
