import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BlockType, HierarchyStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateBlockDto {
  @ApiProperty({ example: 'Tower A' })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'A', description: 'Unique within the community' })
  @IsString() @MinLength(1) @MaxLength(32)
  code!: string;

  @ApiProperty({ enum: BlockType, default: BlockType.TOWER })
  @IsEnum(BlockType)
  type!: BlockType;

  @ApiPropertyOptional({ description: 'Optional parent phase' })
  @IsOptional() @IsString()
  phaseId?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  totalFloors?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

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

export class UpdateBlockDto extends PartialType(CreateBlockDto) {}

export class QueryBlockDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: BlockType })
  @IsOptional() @IsEnum(BlockType)
  type?: BlockType;

  @ApiPropertyOptional({ description: 'Filter by parent phase' })
  @IsOptional() @IsString()
  phaseId?: string;

  @ApiPropertyOptional({ enum: HierarchyStatus })
  @IsOptional() @IsEnum(HierarchyStatus)
  status?: HierarchyStatus;
}
