import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitorStatus, VisitorType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateVisitorDto {
  @ApiProperty({ description: 'Community the visit is for' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ description: 'Resident hosting the visitor' })
  @IsString() @MinLength(1)
  residentId!: string;

  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString() @MinLength(2) @MaxLength(120)
  visitorName!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString() @MinLength(6) @MaxLength(20)
  mobileNumber!: string;

  @ApiPropertyOptional({ example: 'KA01AB1234' })
  @IsOptional() @IsString() @MaxLength(20) vehicleNumber?: string;

  @ApiPropertyOptional({ enum: VisitorType, default: VisitorType.GUEST })
  @IsOptional() @IsEnum(VisitorType) visitorType?: VisitorType;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) purpose?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date) expectedArrival!: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

/** Editable only while PENDING/APPROVED (enforced in the service). */
export class UpdateVisitorDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) visitorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6) @MaxLength(20) mobileNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vehicleNumber?: string;
  @ApiPropertyOptional({ enum: VisitorType }) @IsOptional() @IsEnum(VisitorType) visitorType?: VisitorType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) purpose?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) expectedArrival?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class RejectVisitorDto {
  @ApiPropertyOptional({ example: 'Not expected today' })
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class QueryVisitorDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list visitors for (required — tenant scope)' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional({ enum: VisitorStatus }) @IsOptional() @IsEnum(VisitorStatus) status?: VisitorStatus;
  @ApiPropertyOptional({ enum: VisitorType }) @IsOptional() @IsEnum(VisitorType) visitorType?: VisitorType;
  @ApiPropertyOptional() @IsOptional() @IsString() residentId?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Expected arrival from' })
  @IsOptional() @Type(() => Date) dateFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Expected arrival to' })
  @IsOptional() @Type(() => Date) dateTo?: Date;
}
