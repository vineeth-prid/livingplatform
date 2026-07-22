import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoverageType, TicketPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AddCoverageDto {
  @ApiProperty({ description: 'Asset to cover' })
  @IsString() @MinLength(1)
  assetId!: string;

  @ApiPropertyOptional({ enum: CoverageType, default: CoverageType.FULL })
  @IsOptional() @IsEnum(CoverageType) coverageType?: CoverageType;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) responseTimeHours?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) resolutionTimeHours?: number;

  @ApiPropertyOptional({ example: 'MONTHLY', description: 'Free-form visit cadence' })
  @IsOptional() @IsString() @MaxLength(60) visitFrequency?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}
