import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

/**
 * Record an owner against a unit.
 *
 * Two shapes, one endpoint: name an EXISTING resident by id, or supply the
 * person's details and have them created. The second reuses ResidentService
 * so the owner gets the same login provisioning every other resident gets —
 * there is no separate owner account system.
 */
export class AddUnitOwnerDto {
  @ApiPropertyOptional({ description: 'Existing resident to record as owner' })
  @IsOptional() @IsString() @MinLength(1)
  residentId?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;

  @ApiPropertyOptional({ example: '9876543210', description: 'Becomes their login username' })
  @IsOptional() @IsString() @MaxLength(20) mobile?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;

  @ApiPropertyOptional({ default: true, description: 'The owner the association addresses first' })
  @IsOptional() @IsBoolean() isPrimary?: boolean;

  @ApiPropertyOptional({ example: 50, description: 'Informational share for a jointly-held flat' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  sharePercent?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) startDate?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateUnitOwnerDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  sharePercent?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/** Ending an ownership — a sale, not a correction. */
export class EndUnitOwnerDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Defaults to now' })
  @IsOptional() @Type(() => Date) endDate?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class OwnershipGapQueryDto {
  @ApiPropertyOptional({ default: 200 })
  @IsOptional() @Type(() => Number) @Min(1) @Max(1000) limit?: number;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'Resident taking over the unit' })
  @IsString() @MinLength(1)
  toResidentId!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Defaults to now' })
  @IsOptional() @Type(() => Date) effectiveFrom?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
