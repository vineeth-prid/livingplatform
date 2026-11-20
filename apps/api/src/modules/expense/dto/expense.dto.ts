import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseSource } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YMD_MESSAGE = 'Use a date in the form YYYY-MM-DD';

export class UpsertExpenseCategoryDto {
  @ApiProperty({ example: 'Electricity' })
  @IsString() @MinLength(2) @MaxLength(80) name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ example: 'BESCOM bill — common areas' })
  @IsString() @MinLength(3) @MaxLength(200) title!: string;

  @ApiProperty() @IsString() categoryId!: string;

  @ApiProperty({ example: 18450.5, description: 'Rupees, positive, up to 2 decimals' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;

  @ApiProperty({ example: '2026-11-05' })
  @Matches(YMD, { message: YMD_MESSAGE }) expenseDate!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) payee?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) referenceNumber?: string;
  @ApiPropertyOptional({ example: 'BANK_TRANSFER' }) @IsOptional() @IsString() @MaxLength(40) paymentMethod?: string;
  @ApiPropertyOptional({ description: 'Key from the attachment upload-url endpoint' })
  @IsOptional() @IsString() @MaxLength(500) attachmentKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) attachmentName?: string;
}

/**
 * Every field optional. On a work-order expense only the bookkeeping fields
 * (category, notes, payee, reference, method, attachment) may change — the
 * amount, date and title follow the work order.
 */
export class UpdateExpenseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount?: number;
  @ApiPropertyOptional() @IsOptional() @Matches(YMD, { message: YMD_MESSAGE }) expenseDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) payee?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) referenceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) paymentMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) attachmentKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) attachmentName?: string;
}

export const EXPENSE_PERIODS = ['current-month', 'previous-month', 'current-year'] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];

export class QueryExpenseDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: EXPENSE_PERIODS, description: 'Preset in the community\'s timezone; overrides from/to' })
  @IsOptional() @IsIn(EXPENSE_PERIODS) period?: ExpensePeriod;

  @ApiPropertyOptional({ example: '2026-11-01' }) @IsOptional() @Matches(YMD, { message: YMD_MESSAGE }) from?: string;
  @ApiPropertyOptional({ example: '2026-11-30' }) @IsOptional() @Matches(YMD, { message: YMD_MESSAGE }) to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ enum: ExpenseSource }) @IsOptional() @IsEnum(ExpenseSource) source?: ExpenseSource;

  @ApiPropertyOptional({ description: 'Include reversed work-order expenses (never counted in totals)' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() includeReversed?: boolean;
}

export class ExpenseUploadUrlDto {
  @ApiProperty({ example: 'invoice.pdf' }) @IsString() @MinLength(1) @MaxLength(200) fileName!: string;
  @ApiPropertyOptional({ example: 'application/pdf' }) @IsOptional() @IsString() @MaxLength(100) contentType?: string;
}
