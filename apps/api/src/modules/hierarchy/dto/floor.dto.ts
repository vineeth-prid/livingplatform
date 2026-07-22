import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { HierarchyStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateFloorDto {
  @ApiProperty({ description: 'Parent block id' })
  @IsString()
  blockId!: string;

  @ApiProperty({ example: 3, description: 'Level: -1 basement, 0 ground, 1, 2 …' })
  @Type(() => Number) @IsInt()
  level!: number;

  @ApiPropertyOptional({ example: 'Podium 1' })
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

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

export class UpdateFloorDto extends PartialType(CreateFloorDto) {}

export class QueryFloorDto extends ListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by parent block' })
  @IsOptional() @IsString()
  blockId?: string;

  @ApiPropertyOptional({ enum: HierarchyStatus })
  @IsOptional() @IsEnum(HierarchyStatus)
  status?: HierarchyStatus;
}
