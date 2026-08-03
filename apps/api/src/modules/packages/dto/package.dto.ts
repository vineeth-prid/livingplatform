import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackagePurchaseStatus, ServicePackageStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

/** One catalog service inside a package. */
export class PackageItemDto {
  @ApiProperty({ description: 'An existing Service catalog id — packages never define new services' })
  @IsString()
  serviceId!: string;

  @ApiProperty({ description: 'How many times this service may be redeemed', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  quantity!: number;

  @ApiPropertyOptional({ description: 'List price per delivery; defaults to Service.basePrice' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpsertPackageDto {
  @ApiProperty({ example: '3 Month Home Care' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'What the resident pays for the bundle (₹)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Days the entitlements stay redeemable', default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1095)
  durationDays?: number;

  @ApiPropertyOptional({
    description: 'Property types offered this package. Empty = every type.',
    example: ['2BHK', '3BHK'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  propertyTypes?: string[];

  @ApiPropertyOptional({ enum: ServicePackageStatus, default: ServicePackageStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ServicePackageStatus)
  status?: ServicePackageStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  iconKey?: string;

  @ApiPropertyOptional({ example: '#234B39' })
  @IsOptional()
  @IsString()
  @IsHexColor()
  color?: string;

  @ApiProperty({ type: [PackageItemDto], description: 'The bundled services' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  items!: PackageItemDto[];
}

export class QueryPackageDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ServicePackageStatus })
  @IsOptional()
  @IsEnum(ServicePackageStatus)
  status?: ServicePackageStatus;

  @ApiPropertyOptional({ description: 'Only packages offered to this property type' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  propertyType?: string;
}

export class QueryPurchaseDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: PackagePurchaseStatus })
  @IsOptional()
  @IsEnum(PackagePurchaseStatus)
  status?: PackagePurchaseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentId?: string;
}

/** Buy a package. The amount is ALWAYS taken from the package, never the client. */
export class PurchasePackageDto {
  @ApiProperty()
  @IsString()
  packageId!: string;

  @ApiPropertyOptional({ description: 'Unit the package applies to (defaults to the resident unit)' })
  @IsOptional()
  @IsString()
  unitId?: string;
}

/** Redeem one entitlement — creates an ordinary Service Request. */
export class RedeemPackageDto {
  @ApiProperty({ description: 'Which included service to book' })
  @IsString()
  serviceId!: string;

  @ApiPropertyOptional({ description: 'Preferred date (ISO)' })
  @IsOptional()
  @IsString()
  preferredDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredTimeSlot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
