import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Check oil level and top up if required' })
  @IsString() @MinLength(2) @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() isMandatory?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMandatory?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
}
