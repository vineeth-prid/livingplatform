import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender, ResidentRole, ResidentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateResidentDto {
  @ApiPropertyOptional({ description: 'Auto-generated when omitted (R-000001)' })
  @IsOptional() @IsString() @MaxLength(40)
  residentCode?: string;

  @ApiPropertyOptional({
    enum: ResidentRole,
    description: '"Occupied By" — OWNER or TENANT; also used as the unit assignment role',
  })
  @IsOptional() @IsEnum(ResidentRole) occupiedBy?: ResidentRole;

  @ApiPropertyOptional({ description: 'Assign to this unit on create' })
  @IsOptional() @IsString() unitId?: string;

  @ApiProperty({ example: 'Aisha' })
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Khan' })
  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: '+91 98765 43210' })
  @IsString() @MinLength(4) @MaxLength(40)
  mobile!: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ description: 'Storage key for the profile photo' })
  @IsOptional() @IsString() photoKey?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional() @IsEnum(Gender) gender?: Gender;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) dateOfBirth?: Date;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) occupation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) emergencyContactRelationship?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) moveInDate?: Date;

  @ApiPropertyOptional({ enum: ResidentStatus })
  @IsOptional() @IsEnum(ResidentStatus) status?: ResidentStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({ description: 'Link to a platform user (enables login)' })
  @IsOptional() @IsString() userId?: string;

  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class UpdateResidentDto extends PartialType(CreateResidentDto) {}

/** One row of a bulk resident upload. Unit referenced by unit number. */
export class BulkResidentRowDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiProperty() @IsString() @MinLength(4) @MaxLength(40) mobile!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ enum: ResidentRole }) @IsOptional() @IsEnum(ResidentRole) occupiedBy?: ResidentRole;
  @ApiPropertyOptional({ description: 'Unit number to map to' }) @IsOptional() @IsString() @MaxLength(40) unit?: string;
}

export class BulkResidentUploadDto {
  @ApiProperty({ type: [BulkResidentRowDto] })
  @ValidateNested({ each: true }) @Type(() => BulkResidentRowDto) @IsArray()
  rows!: BulkResidentRowDto[];
}

export class QueryResidentDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ResidentStatus })
  @IsOptional() @IsEnum(ResidentStatus) status?: ResidentStatus;

  @ApiPropertyOptional({ description: 'Filter by tower/block' })
  @IsOptional() @IsString() blockId?: string;

  @ApiPropertyOptional({ description: 'Filter by floor' })
  @IsOptional() @IsString() floorId?: string;

  @ApiPropertyOptional({ description: 'Filter by unit' })
  @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ enum: ResidentRole, description: 'Filter by occupancy role (OWNER/TENANT)' })
  @IsOptional() @IsEnum(ResidentRole) role?: ResidentRole;
}

export class AssignUnitDto {
  @ApiProperty()
  @IsString() @MinLength(1)
  unitId!: string;

  @ApiPropertyOptional({ enum: ResidentRole, default: ResidentRole.PRIMARY })
  @IsOptional() @IsEnum(ResidentRole) role?: ResidentRole;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) moveInDate?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) moveOutDate?: Date;

  @ApiPropertyOptional({ enum: ResidentStatus })
  @IsOptional() @IsEnum(ResidentStatus) status?: ResidentStatus;
}
