import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketSource, TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateTicketDto {
  @ApiProperty({ description: 'Unit the ticket concerns (required)' })
  @IsString() @MinLength(1)
  unitId!: string;

  @ApiProperty({ description: 'Ticket category id (system or tenant)' })
  @IsString() @MinLength(1)
  categoryId!: string;

  @ApiProperty({ example: 'Kitchen tap is leaking' })
  @IsString() @MinLength(3) @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Water dripping steadily from the base of the tap.' })
  @IsString() @MinLength(1) @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketSource, default: TicketSource.ADMIN_PORTAL })
  @IsOptional() @IsEnum(TicketSource) source?: TicketSource;

  @ApiPropertyOptional({ description: 'Resident the ticket is about (optional)' })
  @IsOptional() @IsString() residentId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dueDate?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

/** Update excludes status / assignment / unit — those have dedicated endpoints. */
export class UpdateTicketDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() residentId?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) dueDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class ChangeTicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @ApiPropertyOptional({ description: 'Optional reason, recorded on the timeline' })
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AssignTicketDto {
  @ApiPropertyOptional({ description: 'Assign to a staff member (XOR vendorId)' })
  @IsOptional() @IsString() staffId?: string;

  @ApiPropertyOptional({ description: 'Assign to a vendor (XOR staffId)' })
  @IsOptional() @IsString() vendorId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class QueryTicketDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus }) @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ description: 'Filter by tower/block' }) @IsOptional() @IsString() blockId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() floorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() residentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedStaffId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedVendorId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Created on/after' })
  @IsOptional() @Type(() => Date) dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Created on/before' })
  @IsOptional() @Type(() => Date) dateTo?: Date;
}
