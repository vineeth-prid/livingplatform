import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PersonStatus, StaffRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateStaffDto {
  @ApiProperty({ example: 'EMP-1007' })
  @IsString() @MinLength(1) @MaxLength(40)
  employeeId!: string;

  @ApiProperty({ example: 'Suresh' })
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Raman' })
  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiProperty({ enum: StaffRole })
  @IsEnum(StaffRole)
  role!: StaffRole;

  @ApiPropertyOptional({ example: 'Maintenance' })
  @IsOptional() @IsString() @MaxLength(80) department?: string;

  @ApiProperty({ example: '+91 90000 22222' })
  @IsString() @MinLength(4) @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ description: 'Storage key for the profile photo' })
  @IsOptional() @IsString() photoKey?: string;

  @ApiPropertyOptional({ enum: PersonStatus })
  @IsOptional() @IsEnum(PersonStatus) status?: PersonStatus;

  @ApiPropertyOptional({ description: 'Link to a platform user (enables login)' })
  @IsOptional() @IsString() userId?: string;

  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class UpdateStaffDto extends PartialType(CreateStaffDto) {}

export class QueryStaffDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: StaffRole })
  @IsOptional() @IsEnum(StaffRole) role?: StaffRole;

  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;

  @ApiPropertyOptional({ enum: PersonStatus })
  @IsOptional() @IsEnum(PersonStatus) status?: PersonStatus;
}
