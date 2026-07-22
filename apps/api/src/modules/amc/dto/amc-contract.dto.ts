import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AMCStatus, CoverageType, PaymentFrequency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length,
  MaxLength, Min, MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateAMCContractDto {
  @ApiProperty({ description: 'Community the contract belongs to' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ description: 'Responsible vendor' })
  @IsString() @MinLength(1)
  vendorId!: string;

  @ApiProperty({ example: 'AMC-2026-014', description: 'Unique within the tenant' })
  @IsString() @MinLength(1) @MaxLength(64)
  contractNumber!: string;

  @ApiProperty({ example: 'DG sets — comprehensive AMC' })
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;

  @ApiPropertyOptional({ enum: AMCStatus, default: AMCStatus.DRAFT })
  @IsOptional() @IsEnum(AMCStatus) status?: AMCStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date) startDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date) endDate!: Date;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) renewalReminderDays?: number;

  @ApiProperty({ example: 120000, description: 'Annual cost (2-dp)' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  annualCost!: number;

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional() @IsString() @Length(3, 3) currency?: string;

  @ApiPropertyOptional({ enum: PaymentFrequency, default: PaymentFrequency.YEARLY })
  @IsOptional() @IsEnum(PaymentFrequency) paymentFrequency?: PaymentFrequency;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) contactPerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160) contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() autoRenew?: boolean;
}

/** Community is immutable. Status transitions (activate/terminate) go through here. */
export class UpdateAMCContractDto {
  @ApiPropertyOptional({ description: 'Reassign the responsible vendor' })
  @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ enum: AMCStatus }) @IsOptional() @IsEnum(AMCStatus) status?: AMCStatus;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) startDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) endDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) renewalReminderDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) annualCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @ApiPropertyOptional({ enum: PaymentFrequency }) @IsOptional() @IsEnum(PaymentFrequency) paymentFrequency?: PaymentFrequency;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) contactPerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160) contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoRenew?: boolean;
}

export class RenewAMCContractDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'New contract end date' })
  @Type(() => Date) endDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'New start (defaults to the old end date)' })
  @IsOptional() @Type(() => Date) startDate?: Date;

  @ApiPropertyOptional({ description: 'Revised annual cost for the new term' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) annualCost?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class QueryAMCContractDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list contracts for (required — tenant scope)' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional({ enum: AMCStatus }) @IsOptional() @IsEnum(AMCStatus) status?: AMCStatus;
  @ApiPropertyOptional({ description: 'Contracts covering this asset' }) @IsOptional() @IsString() assetId?: string;
  @ApiPropertyOptional({ enum: CoverageType, description: 'Contracts with a coverage of this type' })
  @IsOptional() @IsEnum(CoverageType) coverageType?: CoverageType;
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Contracts ending on/before this date' })
  @IsOptional() @Type(() => Date) expiringBefore?: Date;
  @ApiPropertyOptional({ description: 'Active contracts within their renewal window' })
  @IsOptional() @Type(() => Boolean) @IsBoolean() renewalDue?: boolean;
}
