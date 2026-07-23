import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PersonStatus } from '@prisma/client';
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
  @ApiPropertyOptional({ example: 'EMP-1007', description: 'Auto-generated when omitted' })
  @IsOptional() @IsString() @MaxLength(40)
  employeeId?: string;

  @ApiProperty({ example: 'Suresh' })
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Raman' })
  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'FACILITY_MANAGER', description: 'Free string — managed via catalog options' })
  @IsString() @MinLength(1) @MaxLength(60)
  role!: string;

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
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;

  @ApiPropertyOptional({ enum: PersonStatus })
  @IsOptional() @IsEnum(PersonStatus) status?: PersonStatus;
}
