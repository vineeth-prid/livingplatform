import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OwnershipType, UnitStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateUnitDto {
  @ApiProperty({ example: 'A-1203' })
  @IsString() @MinLength(1) @MaxLength(40)
  unitNumber!: string;

  @ApiPropertyOptional({ example: '3BHK', description: 'Configurable unit type' })
  @IsOptional() @IsString() @MaxLength(40)
  type?: string;

  // Flexible placement — set whichever levels the community's shape uses.
  @ApiPropertyOptional() @IsOptional() @IsString() phaseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;

  @ApiPropertyOptional({ example: 1180 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  carpetArea?: number;

  @ApiPropertyOptional({ example: 1450 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  builtUpArea?: number;

  @ApiPropertyOptional({ default: 'sqft' })
  @IsOptional() @IsString() @MaxLength(12)
  areaUnit?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  parkingSlots?: number;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional() @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ enum: OwnershipType })
  @IsOptional() @IsEnum(OwnershipType)
  ownership?: OwnershipType;

  @ApiPropertyOptional({ description: 'Owner name (auto-populates owner residents)' })
  @IsOptional() @IsString() @MaxLength(120) ownerName?: string;

  @ApiPropertyOptional({ description: 'Owner phone' })
  @IsOptional() @IsString() @MaxLength(40) ownerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {}

/** One row of a bulk unit upload. Block/floor referenced by name/level — the
 *  service resolves them within the community, creating any that are missing. */
export class BulkUnitRowDto {
  @ApiProperty({ example: 'A-1203' })
  @IsString() @MinLength(1) @MaxLength(40)
  unitNumber!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) type?: string;
  @ApiPropertyOptional({ description: 'Block name or code (created if missing)' })
  @IsOptional() @IsString() @MaxLength(80) block?: string;
  @ApiPropertyOptional({ description: 'Phase name or code (created if missing)' })
  @IsOptional() @IsString() @MaxLength(80) phase?: string;
  @ApiPropertyOptional({ description: 'Floor level (integer)' })
  @IsOptional() @Type(() => Number) @IsInt() floorLevel?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) parkingSlots?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) builtUpArea?: number;
  @ApiPropertyOptional({ enum: OwnershipType }) @IsOptional() @IsEnum(OwnershipType) ownership?: OwnershipType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) ownerPhone?: string;
}

export class BulkUnitUploadDto {
  @ApiProperty({ type: [BulkUnitRowDto] })
  @ValidateNested({ each: true }) @Type(() => BulkUnitRowDto) @IsArray()
  rows!: BulkUnitRowDto[];
}

export class QueryUnitDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional() @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ enum: OwnershipType })
  @IsOptional() @IsEnum(OwnershipType)
  ownership?: OwnershipType;

  @ApiPropertyOptional() @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
}
