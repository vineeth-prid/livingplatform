import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionModel, PayoutFrequency, VendorPayoutStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCommissionConfigDto {
  @ApiProperty({ enum: CommissionModel }) @IsEnum(CommissionModel) model!: CommissionModel;
  @ApiPropertyOptional({ description: 'Percent (10 = 10%) — PERCENTAGE only' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(100) rate?: number;
  @ApiPropertyOptional({ description: 'Per transaction — FIXED only' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) fixedAmount?: number;
  @ApiProperty({ enum: PayoutFrequency }) @IsEnum(PayoutFrequency) payoutFrequency!: PayoutFrequency;
  @ApiProperty({ example: '2026-12-01' }) @Matches(YMD) effectiveFrom!: string;
  @ApiPropertyOptional({ description: 'Only for this service; omit for the vendor default' })
  @IsOptional() @IsString() serviceId?: string;
}

export class QueryVendorFinanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional({ example: '2026-11-01' }) @IsOptional() @Matches(YMD) from?: string;
  @ApiPropertyOptional({ example: '2026-11-30' }) @IsOptional() @Matches(YMD) to?: string;
  @ApiPropertyOptional({ enum: ['UNSETTLED', 'PENDING', 'PAID'] })
  @IsOptional() @IsIn(['UNSETTLED', 'PENDING', 'PAID']) payoutStatus?: 'UNSETTLED' | 'PENDING' | 'PAID';
  @ApiPropertyOptional({ enum: PayoutFrequency }) @IsOptional() @IsEnum(PayoutFrequency) frequency?: PayoutFrequency;
}

export class QueryPayoutsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional({ enum: VendorPayoutStatus }) @IsOptional() @IsEnum(VendorPayoutStatus) status?: VendorPayoutStatus;
  @ApiPropertyOptional({ enum: PayoutFrequency }) @IsOptional() @IsEnum(PayoutFrequency) frequency?: PayoutFrequency;
  @ApiPropertyOptional() @IsOptional() @Matches(YMD) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(YMD) to?: string;
}

export class GeneratePayoutsDto {
  @ApiPropertyOptional({ description: 'One vendor; omit for every vendor' }) @IsOptional() @IsString() vendorId?: string;
}

export class MarkPayoutPaidDto {
  @ApiProperty({ description: 'Must equal the payout’s payable amount' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount!: number;
  @ApiProperty({ example: '2026-12-02' }) @IsDateString() paidAt!: string;
  @ApiProperty({ description: 'Bank / UPI transaction reference' }) @IsString() @MaxLength(120) reference!: string;
  @ApiPropertyOptional({ example: 'NEFT' }) @IsOptional() @IsString() @MaxLength(40) method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CancelPayoutDto {
  @ApiProperty() @IsString() @MaxLength(300) reason!: string;
}

export class VendorInvoiceDto {
  @ApiProperty() @IsString() @MaxLength(80) invoiceNumber!: string;
  @ApiPropertyOptional({ description: 'Storage key from the invoice upload URL' }) @IsOptional() @IsString() fileKey?: string;
}

export class InvoiceUploadUrlDto {
  @ApiProperty() @IsString() @MaxLength(200) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contentType?: string;
}
