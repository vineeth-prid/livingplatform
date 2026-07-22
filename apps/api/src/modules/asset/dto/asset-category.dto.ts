import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsHexColor, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

const CODE = /^[A-Z0-9_]+$/;

export class CreateAssetCategoryDto {
  @ApiProperty({ description: 'Community the category belongs to' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ example: 'HVAC' })
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'HVAC', description: 'Unique within the community (A–Z, 0–9, _)' })
  @IsString() @MinLength(1) @MaxLength(40) @Matches(CODE, { message: 'code must be uppercase A–Z, 0–9, _' })
  code!: string;

  @ApiPropertyOptional({ description: 'Parent category id (for a sub-category)' })
  @IsOptional() @IsString() parentCategoryId?: string;

  @ApiPropertyOptional({ example: 'wind', description: 'Lucide icon name' })
  @IsOptional() @IsString() @MaxLength(60) icon?: string;

  @ApiPropertyOptional({ example: '#3F6E8C' })
  @IsOptional() @IsHexColor() color?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateAssetCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentCategoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryAssetCategoryDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list categories for' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional({ description: 'Only root categories when true' })
  @IsOptional() @IsString() parentCategoryId?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() activeOnly?: boolean;
}
