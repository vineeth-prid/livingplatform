import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

// ── Maintenance charge configuration (Feature 3) ─────────────────────────────

export class UpsertMaintenanceChargeDto {
  @ApiProperty({ description: 'Property type — matches Unit.type, e.g. "2BHK", "Villa"' })
  @IsString()
  @MaxLength(60)
  propertyType!: string;

  @ApiProperty({ description: 'Monthly maintenance amount (₹)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyAmount!: number;

  @ApiPropertyOptional({ description: 'Quarterly amount (₹). Defaults to 3× monthly.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quarterlyAmount?: number;

  @ApiPropertyOptional({ description: 'Yearly amount (₹). Defaults to 12× monthly.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  yearlyAmount?: number;

  @ApiPropertyOptional({ description: 'Flat late fee (₹)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lateFeeAmount?: number;

  @ApiPropertyOptional({ description: 'Late fee as a % of the outstanding amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  lateFeePercent?: number;

  @ApiPropertyOptional({ description: 'Days after the due date before a late fee applies' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  gracePeriodDays?: number;

  @ApiProperty({ description: 'Date this rate takes effect (future dates schedule a revision)' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ description: 'Last date this rate applies (open-ended when omitted)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QueryMaintenanceChargeDto extends ListQueryDto {
  @ApiPropertyOptional({ description: 'Filter to one property type' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  propertyType?: string;

  @ApiPropertyOptional({ description: 'Only rates in force today', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  currentOnly?: boolean;
}

// ── Invoice generation & queries (Feature 4) ─────────────────────────────────

export class GenerateInvoicesDto {
  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  cycle!: BillingCycle;

  @ApiPropertyOptional({
    description: 'Any date inside the period to bill. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  periodDate?: string;

  @ApiPropertyOptional({ description: 'Day of month the bill falls due (1–31)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional({
    description: 'Preview only — compute the run without writing invoices',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ description: 'Restrict the run to specific units' })
  @IsOptional()
  @IsString({ each: true })
  unitIds?: string[];
}

export class QueryInvoiceDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  cycle?: BillingCycle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentId?: string;

  @ApiPropertyOptional({ description: 'Only invoices due on or after this date' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ description: 'Only invoices due on or before this date' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({ description: 'Only unpaid/overdue invoices', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  outstandingOnly?: boolean;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ description: 'Credit/debit adjustment (₹); negative discounts the bill' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  adjustment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RecordOfflinePaymentDto {
  @ApiProperty({ description: 'Amount received (₹)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ description: 'cash | cheque | neft | upi …' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  method?: string;

  @ApiPropertyOptional({ description: 'Cheque number / UTR / reference' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class CollectionSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Months of history in the collection trend', default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
