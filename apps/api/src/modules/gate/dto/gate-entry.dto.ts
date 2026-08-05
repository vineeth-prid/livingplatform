import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GateEntryStatus, GateEntryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

/**
 * Create a gate entry. Written entry-type-agnostically from the start: DELIVERY
 * is the only type the UI offers today, and VISITOR / SERVICE_PERSONNEL /
 * VEHICLE need no new field on this DTO to be turned on.
 */
export class CreateGateEntryDto {
  @ApiPropertyOptional({
    enum: GateEntryType,
    default: GateEntryType.DELIVERY,
    description: 'What kind of arrival this is. Delivery is the default.',
  })
  @IsOptional() @IsEnum(GateEntryType) entryType?: GateEntryType;

  @ApiProperty({ description: 'Unit the arrival is for' })
  @IsString() @MinLength(1)
  unitId!: string;

  @ApiPropertyOptional({
    description: 'Resident to notify. Resolved from the unit when omitted.',
  })
  @IsOptional() @IsString() residentId?: string;

  @ApiPropertyOptional({ description: 'Which gate; defaults to the community’s first' })
  @IsOptional() @IsString() gateId?: string;

  @ApiPropertyOptional({ example: 'Swiggy', description: 'Delivery brand / company' })
  @IsOptional() @IsString() @MaxLength(120) vendorName?: string;

  @ApiPropertyOptional({ example: 'FOOD', description: 'Free-form delivery category' })
  @IsOptional() @IsString() @MaxLength(60) deliveryType?: string;

  @ApiProperty({ example: 'Ramesh', description: 'Name of the person at the gate' })
  @IsString() @MinLength(1) @MaxLength(120)
  personName!: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional() @IsString() @MaxLength(40) mobileNumber?: string;

  @ApiPropertyOptional({ example: 'KA01AB1234' })
  @IsOptional() @IsString() @MaxLength(40) vehicleNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;

  @ApiPropertyOptional({ description: 'Storage key of the gate photo' })
  @IsOptional() @IsString() @MaxLength(500) photoKey?: string;
}

/** Correct an entry's details. Status is never set directly — use the actions. */
export class UpdateGateEntryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) vendorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) deliveryType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) personName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) mobileNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) vehicleNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) photoKey?: string;
}

export class GateDecisionDto {
  @ApiPropertyOptional({ description: 'Optional note shown to security' })
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class QueryGateEntryDto extends ListQueryDto {
  /**
   * MUST live on the DTO, not as a separate `@Query('communityId')` parameter.
   *
   * The global ValidationPipe runs `forbidNonWhitelisted: true` against the
   * whole query object, so any parameter absent from this class is rejected
   * outright — `GET /gate/deliveries?communityId=…` 400'd with "property
   * communityId should not exist" on every single call, leaving the gate
   * register permanently empty while creation quietly succeeded.
   *
   * Optional here because `/gate/deliveries/mine` is self-scoped and sends none.
   */
  @ApiPropertyOptional({ description: 'Community to list entries for' })
  @IsOptional() @IsString() communityId?: string;

  @ApiPropertyOptional({ enum: GateEntryType })
  @IsOptional() @IsEnum(GateEntryType) entryType?: GateEntryType;

  @ApiPropertyOptional({ enum: GateEntryStatus })
  @IsOptional() @IsEnum(GateEntryStatus) status?: GateEntryStatus;

  @ApiPropertyOptional({ description: 'Filter to one unit' })
  @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ description: 'Filter to one resident' })
  @IsOptional() @IsString() residentId?: string;

  @ApiPropertyOptional({ description: 'Filter to one gate' })
  @IsOptional() @IsString() gateId?: string;

  @ApiPropertyOptional({ description: 'Filter to the security staff who recorded it' })
  @IsOptional() @IsString() createdById?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery brand' })
  @IsOptional() @IsString() @MaxLength(120) vendorName?: string;

  /** The portal's Delivery history offers this filter; without it the whole
   *  request was rejected the moment an admin used the Type dropdown. */
  @ApiPropertyOptional({ description: 'Filter by delivery type (FOOD, COURIER, …)' })
  @IsOptional() @IsString() @MaxLength(60) deliveryType?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateTo?: Date;

  @ApiPropertyOptional({
    description: 'Only entries still waiting on the resident (CREATED or NOTIFIED)',
  })
  @IsOptional() @Type(() => Boolean) @IsBoolean() pendingOnly?: boolean;

  @ApiPropertyOptional({ description: 'Restrict to entries created today (gate desk view)' })
  @IsOptional() @Type(() => Boolean) @IsBoolean() todayOnly?: boolean;
}

export class GateStatisticsQueryDto {
  /** Same reason as QueryGateEntryDto — see the note there. */
  @ApiPropertyOptional({ description: 'Community to report on' })
  @IsOptional() @IsString() communityId?: string;

  @ApiPropertyOptional({
    description: 'Window in days for the trend and vendor/peak breakdowns',
    default: 30,
  })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365)
  days?: number;
}

export class CreateGateDto {
  @ApiProperty({ example: 'Main Gate' })
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'MG' })
  @IsOptional() @IsString() @MaxLength(20) code?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
