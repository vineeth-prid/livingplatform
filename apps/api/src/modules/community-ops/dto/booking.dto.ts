import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateBookingDto {
  @ApiProperty({ description: 'Community the booking is for' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ description: 'Amenity to book' })
  @IsString() @MinLength(1)
  amenityId!: string;

  @ApiProperty({ description: 'Resident making the booking' })
  @IsString() @MinLength(1)
  residentId!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Slot start (absolute)' })
  @Type(() => Date) startTime!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Slot end (absolute)' })
  @Type(() => Date) endTime!: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

/** Manager-only status/remarks update (residents use cancel). */
export class UpdateBookingDto {
  @ApiPropertyOptional({ enum: BookingStatus }) @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

export class QueryBookingDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list bookings for (required — tenant scope)' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() residentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() amenityId?: string;
  @ApiPropertyOptional({ enum: BookingStatus }) @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Booking date from' })
  @IsOptional() @Type(() => Date) dateFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Booking date to' })
  @IsOptional() @Type(() => Date) dateTo?: Date;
}
