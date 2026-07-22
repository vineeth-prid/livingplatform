import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCondition, AssetCriticality, AssetStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateAssetDto {
  @ApiProperty({ description: 'Community the asset belongs to' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ description: 'Asset category id' })
  @IsString() @MinLength(1)
  categoryId!: string;

  @ApiProperty({ example: 'DG-001', description: 'Unique within the tenant' })
  @IsString() @MinLength(1) @MaxLength(64)
  assetCode!: string;

  @ApiProperty({ example: '500 kVA Diesel Generator — Tower A' })
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) manufacturer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) model?: string;

  @ApiPropertyOptional({ description: 'Unique within the tenant when provided' })
  @IsOptional() @IsString() @MaxLength(120) serialNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) barcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) qrCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) locationDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;
  @ApiPropertyOptional({ description: 'Unit (optional — omit for common-area assets)' })
  @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) purchaseDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) installationDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) warrantyExpiry?: Date;

  @ApiPropertyOptional({ example: 120, description: 'Expected life in months' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) expectedLifeMonths?: number;

  @ApiPropertyOptional({ enum: AssetStatus, default: AssetStatus.ACTIVE })
  @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @ApiPropertyOptional({ enum: AssetCriticality, default: AssetCriticality.MEDIUM })
  @IsOptional() @IsEnum(AssetCriticality) criticality?: AssetCriticality;
  @ApiPropertyOptional({ enum: AssetCondition, default: AssetCondition.GOOD })
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;

  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

/** Every field optional; community is immutable (not present here). */
export class UpdateAssetDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(64) assetCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) manufacturer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) barcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) qrCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) locationDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) purchaseDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) installationDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) warrantyExpiry?: Date;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) expectedLifeMonths?: number;

  @ApiPropertyOptional({ enum: AssetStatus }) @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @ApiPropertyOptional({ enum: AssetCriticality }) @IsOptional() @IsEnum(AssetCriticality) criticality?: AssetCriticality;
  @ApiPropertyOptional({ enum: AssetCondition }) @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;

  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class QueryAssetDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list assets for (required — tenant scope)' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ enum: AssetStatus }) @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @ApiPropertyOptional({ enum: AssetCriticality }) @IsOptional() @IsEnum(AssetCriticality) criticality?: AssetCriticality;
  @ApiPropertyOptional({ enum: AssetCondition }) @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @ApiPropertyOptional() @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Warranty expiring on/after' })
  @IsOptional() @Type(() => Date) warrantyFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Warranty expiring on/before' })
  @IsOptional() @Type(() => Date) warrantyTo?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) installedFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) installedTo?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) purchasedFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) purchasedTo?: Date;
}
