import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search term', example: 'A-12' })
  @IsString() @MinLength(1) @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5, description: 'Max hits per category' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20)
  limit = 5;
}
