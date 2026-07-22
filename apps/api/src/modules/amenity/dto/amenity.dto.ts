import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { HierarchyStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateAmenityDto {
  @ApiProperty({ example: 'Swimming Pool' })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'POOL' })
  @IsOptional() @IsString() @MaxLength(32)
  code?: string;

  @ApiPropertyOptional({ example: 'Recreation', description: 'Configurable grouping' })
  @IsOptional() @IsString() @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Clubhouse, Level 1' })
  @IsOptional() @IsString() @MaxLength(160)
  location?: string;

  @ApiPropertyOptional({ default: false, description: 'Bookable once the booking engine lands' })
  @IsOptional() @IsBoolean()
  isBookable?: boolean;

  @ApiPropertyOptional({ description: '{ mon: { open, close }, … }' })
  @IsOptional()
  operatingHours?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Storage key for the amenity image' })
  @IsOptional() @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: HierarchyStatus })
  @IsOptional() @IsEnum(HierarchyStatus)
  status?: HierarchyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateAmenityDto extends PartialType(CreateAmenityDto) {}

export class QueryAmenityDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ enum: HierarchyStatus })
  @IsOptional() @IsEnum(HierarchyStatus)
  status?: HierarchyStatus;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isBookable?: boolean;
}
