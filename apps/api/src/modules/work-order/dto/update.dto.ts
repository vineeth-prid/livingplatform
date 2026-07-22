import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** A progress update on a work order. */
export class CreateWorkOrderUpdateDto {
  @ApiProperty({ example: 'Removed 4 of 6 old fittings; awaiting stock for 2.' })
  @IsString() @MinLength(1) @MaxLength(4000)
  comment!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  progressPercent?: number;

  @ApiPropertyOptional({ default: false, description: 'Internal updates hidden from non-staff' })
  @IsOptional() @IsBoolean()
  isInternal?: boolean;
}
