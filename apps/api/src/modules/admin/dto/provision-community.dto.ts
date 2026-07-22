import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommunityType } from '@prisma/client';
import {
  IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';

/**
 * Platform-Admin provisioning: create a community (its own tenant, under the
 * hood) AND its Association Admin in one atomic operation. The association then
 * signs in and builds the community out (blocks, units, villas, amenities…).
 */
export class ProvisionCommunityDto {
  // ── Community ──
  @ApiProperty({ example: 'The Arbour' })
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'ARB', description: 'Short admin code' })
  @IsString() @MinLength(2) @MaxLength(32)
  code!: string;

  @ApiProperty({ enum: CommunityType, default: CommunityType.APARTMENT })
  @IsEnum(CommunityType)
  type!: CommunityType;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) state?: string;

  // ── Association Admin (the customer who will run this community) ──
  @ApiProperty({ example: 'admin@thearbour.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'Asha' })
  @IsString() @MinLength(1) @MaxLength(80)
  adminFirstName!: string;

  @ApiProperty({ example: 'Rao' })
  @IsString() @MinLength(1) @MaxLength(80)
  adminLastName!: string;
}
