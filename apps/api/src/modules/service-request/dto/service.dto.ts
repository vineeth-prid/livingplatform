import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateServiceDto {
  @ApiPropertyOptional({ description: 'Platform Admin only: target tenant (omit for a system default)' })
  @IsOptional() @IsString() tenantId?: string;

  @ApiProperty({ example: 'PEST_CONTROL' })
  @IsString() @MinLength(1) @MaxLength(40)
  key!: string;

  @ApiProperty({ example: 'Pest Control' })
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional({ example: 'bug' }) @IsOptional() @IsString() @MaxLength(60) iconKey?: string;
  @ApiPropertyOptional({ example: '#4E8069' }) @IsOptional() @IsString() @MaxLength(20) color?: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({
    description: 'List price for one delivery (₹). Used to price packages and show savings.',
  })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

/** Enable / disable a service. Services are never deleted — see the controller. */
export class SetServiceStatusDto {
  @ApiProperty({ description: 'true = bookable by residents, false = hidden from the app' })
  @IsBoolean()
  isActive!: boolean;
}

export class QueryServiceDto {
  @ApiPropertyOptional({ description: 'Only active services', default: false })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Free-text search on name/key' })
  @IsOptional() @IsString() @MaxLength(120)
  search?: string;
}

/** One priced option within a service. `id` present = update, absent = create. */
export class ServiceVariantInputDto {
  @ApiPropertyOptional({ description: 'Omit to create a new option' })
  @IsOptional() @IsString() id?: string;

  @ApiProperty({ example: 'SUV' })
  @IsString() @MinLength(1) @MaxLength(60)
  name!: string;

  @ApiProperty({ example: 500, description: 'Price for ONE unit of this option' })
  @Type(() => Number) @IsNumber() @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 45, description: 'Overrides the service estimate' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  durationMinutes?: number;
}

/**
 * The complete set of options for a service. Sending fewer than exist
 * DEACTIVATES the missing ones — they are never hard-deleted, because a booked
 * request must keep resolving the option and price it was made under.
 */
export class SetServiceVariantsDto {
  @ApiProperty({ type: [ServiceVariantInputDto] })
  @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => ServiceVariantInputDto)
  variants!: ServiceVariantInputDto[];
}
