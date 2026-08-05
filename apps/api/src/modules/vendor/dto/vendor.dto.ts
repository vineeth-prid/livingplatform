import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PersonStatus } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateVendorDto {
  @ApiPropertyOptional({
    description: 'Platform Admin only: target tenant. Ignored for tenant callers.',
  })
  @IsOptional() @IsString() tenantId?: string;

  @ApiPropertyOptional({ example: 'V-ELE-001' })
  @IsOptional() @IsString() @MaxLength(40) code?: string;

  @ApiProperty({ example: 'Rakesh Kumar' })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'BrightSpark Electricals' })
  @IsOptional() @IsString() @MaxLength(160) companyName?: string;

  /**
   * Kept for backward compatibility and reporting, but no longer collected in
   * the vendor form: the primary category duplicated `serviceCategories` and
   * bound to the same option list, which is why every field showed identical
   * choices. When omitted it is derived from the first service the vendor
   * covers. Speciality now lives on STAFF, where auto-assignment needs it.
   */
  @ApiPropertyOptional({
    example: 'ELECTRICAL',
    description: 'Derived from the first entry of `serviceCategories` when omitted',
  })
  @IsOptional() @IsString() @MaxLength(60)
  category?: string;

  /**
   * The SERVICE KEYS this vendor delivers, taken from the community's active
   * services catalog — not a separate free-text list. This is what lets a
   * service request be auto-assigned to a vendor who actually offers it.
   */
  @ApiPropertyOptional({ type: [String], description: 'Service keys this vendor delivers' })
  @IsOptional() @IsArray() @IsString({ each: true })
  serviceCategories?: string[];

  @ApiProperty({ example: '+91 90000 11111' })
  @IsString() @MinLength(4) @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;

  @ApiPropertyOptional({ type: [String], description: 'Community ids this vendor covers' })
  @IsOptional() @IsArray() @IsString({ each: true })
  communityIds?: string[];

  @ApiPropertyOptional({ enum: PersonStatus })
  @IsOptional() @IsEnum(PersonStatus) status?: PersonStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) remarks?: string;

  @ApiPropertyOptional({ description: 'Link to a platform user (enables login)' })
  @IsOptional() @IsString() userId?: string;

  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {}

export class QueryVendorDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ enum: PersonStatus })
  @IsOptional() @IsEnum(PersonStatus) status?: PersonStatus;

  @ApiPropertyOptional({ description: 'Vendors covering this community' })
  @IsOptional() @IsString() communityId?: string;
}
