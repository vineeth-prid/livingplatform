import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentGatewayMode, PaymentPurpose } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Payload for saving ONE community gateway account. Secrets are write-only:
 * they arrive here, get encrypted, and never appear in any response.
 * Omitting a secret field leaves the stored value untouched (so an admin can
 * flip `enabled` or fix the key id without re-entering the secret).
 */
export class UpsertPaymentConfigDto {
  @ApiPropertyOptional({ enum: PaymentGatewayMode, default: PaymentGatewayMode.TEST })
  @IsOptional()
  @IsEnum(PaymentGatewayMode)
  mode?: PaymentGatewayMode;

  @ApiPropertyOptional({ description: 'Label shown to admins, e.g. "Maintenance collections"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountName?: string;

  @ApiPropertyOptional({ description: 'Razorpay Merchant ID' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchantId?: string;

  @ApiPropertyOptional({ description: 'Razorpay Key ID (public — sent to checkout)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyId?: string;

  @ApiPropertyOptional({ description: 'Razorpay Key Secret (write-only, encrypted at rest)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  keySecret?: string;

  @ApiPropertyOptional({ description: 'Razorpay webhook signing secret (write-only, encrypted)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  webhookSecret?: string;

  @ApiPropertyOptional({ description: 'Accept payments on this rail' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PaymentPurposeParamDto {
  @ApiProperty({ enum: PaymentPurpose })
  @IsEnum(PaymentPurpose)
  purpose!: PaymentPurpose;
}

/**
 * What the API returns for a gateway account. Note what is ABSENT: keySecret
 * and webhookSecret. `hasKeySecret` / `hasWebhookSecret` are the only signal a
 * client gets, which is all any UI needs.
 */
export interface PaymentConfigStatus {
  purpose: PaymentPurpose;
  provider: string;
  mode: PaymentGatewayMode;
  accountName: string | null;
  merchantId: string | null;
  /** Masked — e.g. "••••••••bC3f". The full key id is only sent at checkout. */
  keyIdMasked: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  enabled: boolean;
  /** True when enabled AND both key id and secret are present. */
  ready: boolean;
  updatedAt: Date | null;
}
