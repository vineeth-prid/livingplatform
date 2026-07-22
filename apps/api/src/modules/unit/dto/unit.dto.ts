import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OwnershipType, UnitStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
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

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {}

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
