import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentPurpose, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

/**
 * Open a checkout. Exactly one target: an invoice (MAINTENANCE) or a service
 * request (SERVICE) — the target decides which community Razorpay account is
 * used, so the two rails can never be mixed up.
 */
export class CreateCheckoutDto {
  @ApiProperty({ enum: PaymentPurpose })
  @IsEnum(PaymentPurpose)
  purpose!: PaymentPurpose;

  @ApiPropertyOptional({ description: 'Maintenance invoice being paid' })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Service request being paid for' })
  @IsOptional()
  @IsString()
  serviceRequestId?: string;

  @ApiPropertyOptional({
    description: 'Service package purchase being paid for (amount comes from the package)',
  })
  @IsOptional()
  @IsString()
  packagePurchaseId?: string;

  @ApiPropertyOptional({
    description: 'Amount (₹). Required for SERVICE; defaults to the invoice balance for MAINTENANCE.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount?: number;
}

/** Razorpay checkout callback — verified server-side before anything is trusted. */
export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  razorpaySignature!: string;
}

export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Partial refund amount (₹). Full refund when omitted.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueryPaymentDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: PaymentPurpose })
  @IsOptional()
  @IsEnum(PaymentPurpose)
  purpose?: PaymentPurpose;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** What the Resident PWA needs to open the Razorpay checkout widget. */
export interface CheckoutSession {
  paymentId: string;
  orderId: string;
  /** Public Razorpay Key ID for this community + rail. Never the secret. */
  keyId: string;
  amount: number;
  amountMinor: number;
  currency: string;
  purpose: PaymentPurpose;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}
