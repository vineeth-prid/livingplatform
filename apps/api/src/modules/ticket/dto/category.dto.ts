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

export class CreateTicketCategoryDto {
  @ApiPropertyOptional({ description: 'Platform Admin only: target tenant (omit for a system default)' })
  @IsOptional() @IsString() tenantId?: string;

  @ApiProperty({ example: 'CARPENTRY' })
  @IsString() @MinLength(1) @MaxLength(40)
  key!: string;

  @ApiProperty({ example: 'Carpentry' })
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional({ example: '#6A6255' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
  @ApiPropertyOptional({ example: 'hammer' }) @IsOptional() @IsString() @MaxLength(60) iconKey?: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateTicketCategoryDto extends PartialType(CreateTicketCategoryDto) {}

export class QueryTicketCategoryDto {
  @ApiPropertyOptional({ description: 'Only active categories', default: false })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  activeOnly?: boolean;
}
