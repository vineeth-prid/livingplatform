import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
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

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class QueryServiceDto {
  @ApiPropertyOptional({ description: 'Only active services', default: false })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  activeOnly?: boolean;
}
