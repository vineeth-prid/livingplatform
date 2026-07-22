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
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreatePhaseDto {
  @ApiProperty({ example: 'Phase 1' })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'P1', description: 'Unique within the community' })
  @IsString() @MinLength(1) @MaxLength(32)
  code!: string;

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

export class UpdatePhaseDto extends PartialType(CreatePhaseDto) {}

export class QueryPhaseDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: HierarchyStatus })
  @IsOptional() @IsEnum(HierarchyStatus)
  status?: HierarchyStatus;
}
