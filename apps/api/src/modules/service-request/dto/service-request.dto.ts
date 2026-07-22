import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceRequestStatus, TicketPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateServiceRequestDto {
  @ApiProperty({ description: 'Service from the catalog' })
  @IsString() @MinLength(1)
  serviceId!: string;

  @ApiProperty({ description: 'Unit the work is for (required)' })
  @IsString() @MinLength(1)
  unitId!: string;

  @ApiProperty({ example: 'Fan not working in the master bedroom' })
  @IsString() @MinLength(3) @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'The ceiling fan has stopped; regulator seems fine.' })
  @IsString() @MinLength(1) @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;

  @ApiPropertyOptional({ description: 'Resident the request is for (optional)' })
  @IsOptional() @IsString() residentId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) preferredDate?: Date;

  @ApiPropertyOptional({ example: 'Morning (9-12)' })
  @IsOptional() @IsString() @MaxLength(60) preferredTimeSlot?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

/** Update excludes status / assignment / scheduling actuals — dedicated endpoints. */
export class UpdateServiceRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() residentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class ChangeServiceRequestStatusDto {
  @ApiProperty({ enum: ServiceRequestStatus })
  @IsEnum(ServiceRequestStatus)
  status!: ServiceRequestStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AssignServiceRequestDto {
  @ApiPropertyOptional({ description: 'Assign to staff (XOR vendorId)' })
  @IsOptional() @IsString() staffId?: string;

  @ApiPropertyOptional({ description: 'Assign to vendor (XOR staffId)' })
  @IsOptional() @IsString() vendorId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ScheduleServiceRequestDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) preferredDate?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) preferredTimeSlot?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) actualStart?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) actualEnd?: Date;
}

export class LinkTicketDto {
  @ApiProperty({ description: 'Existing ticket id to link' })
  @IsString() @MinLength(1)
  ticketId!: string;
}

export class CreateTicketFromRequestDto {
  @ApiProperty({ description: 'Ticket category for the created ticket' })
  @IsString() @MinLength(1)
  categoryId!: string;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
}

export class QueryServiceRequestDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ServiceRequestStatus }) @IsOptional() @IsEnum(ServiceRequestStatus) status?: ServiceRequestStatus;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() residentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedStaffId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedVendorId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateTo?: Date;
}
