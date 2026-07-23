import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, WorkOrderOriginType, WorkOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateWorkOrderDto {
  @ApiProperty({ example: 'Replace corridor light fittings — Tower A L3' })
  @IsString() @MinLength(3) @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Swap 6 failed LED panels on the 3rd floor corridor.' })
  @IsString() @MinLength(1) @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ description: 'Unit (optional — omit for common-area work)' })
  @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;

  @ApiPropertyOptional({ enum: WorkOrderOriginType, default: WorkOrderOriginType.MANUAL })
  @IsOptional() @IsEnum(WorkOrderOriginType) originType?: WorkOrderOriginType;

  @ApiPropertyOptional({ description: 'Loose id of the origin (ticket / service request / …); no FK' })
  @IsOptional() @IsString() originId?: string;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ example: 4000, description: 'Estimated labour cost' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) estimatedLabourCost?: number;

  @ApiPropertyOptional({ example: 12000, description: 'Estimated material cost' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) estimatedMaterialCost?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dueDate?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

/** Update excludes status / assignment — those have dedicated endpoints. */
export class UpdateWorkOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedHours?: number;

  @ApiPropertyOptional({ example: 4000 })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) estimatedLabourCost?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) estimatedMaterialCost?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) actualHours?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dueDate?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class ChangeWorkOrderStatusDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus)
  status!: WorkOrderStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AssignWorkOrderDto {
  @ApiPropertyOptional({ description: 'Assign to staff (XOR vendorId)' })
  @IsOptional() @IsString() staffId?: string;

  @ApiPropertyOptional({ description: 'Assign to vendor (XOR staffId)' })
  @IsOptional() @IsString() vendorId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class VerifyWorkOrderDto {
  @ApiPropertyOptional({ example: 'Checked on site — fittings working, area clean.' })
  @IsOptional() @IsString() @MaxLength(2000) remarks?: string;
}

export class ApproveWorkOrderDto {
  @ApiPropertyOptional({ example: 'Budget available — proceed with the contractor.' })
  @IsOptional() @IsString() @MaxLength(2000) remarks?: string;
}

export class RejectWorkOrderDto {
  @ApiProperty({ example: 'Out of budget this quarter — defer to next cycle.' })
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
}

export class QueryWorkOrderDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: WorkOrderStatus }) @IsOptional() @IsEnum(WorkOrderStatus) status?: WorkOrderStatus;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional({ enum: WorkOrderOriginType }) @IsOptional() @IsEnum(WorkOrderOriginType) originType?: WorkOrderOriginType;
  @ApiPropertyOptional({ description: 'Filter by tower/block' }) @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedStaffId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedVendorId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateTo?: Date;
}
