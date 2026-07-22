import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceFrequency, TicketPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateMaintenancePlanDto {
  @ApiProperty({ description: 'Community the plan belongs to' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ description: 'Asset the plan maintains' })
  @IsString() @MinLength(1)
  assetId!: string;

  @ApiProperty({ example: 'Quarterly DG servicing' })
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;

  @ApiProperty({ enum: MaintenanceFrequency, default: MaintenanceFrequency.MONTHLY })
  @IsEnum(MaintenanceFrequency)
  frequencyType!: MaintenanceFrequency;

  @ApiPropertyOptional({ default: 1, description: 'e.g. every 2 WEEKS' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365)
  frequencyInterval?: number;

  @ApiPropertyOptional({ example: '0 6 1 * *', description: 'Required when frequencyType = CUSTOM' })
  @IsOptional() @IsString() @MaxLength(120)
  cronExpression?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  startDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) endDate?: Date;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimatedDurationMinutes?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() requiresVerification?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Asset & community are immutable — not present here. */
export class UpdateMaintenancePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ enum: MaintenanceFrequency }) @IsOptional() @IsEnum(MaintenanceFrequency) frequencyType?: MaintenanceFrequency;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) frequencyInterval?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) cronExpression?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) startDate?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) endDate?: Date;
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimatedDurationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresVerification?: boolean;
  @ApiPropertyOptional({ description: 'Toggle to pause/resume the plan' }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryMaintenancePlanDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list plans for (required — tenant scope)' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string;
  @ApiPropertyOptional({ description: "Filter by the asset's category" }) @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ enum: MaintenanceFrequency }) @IsOptional() @IsEnum(MaintenanceFrequency) frequencyType?: MaintenanceFrequency;
  @ApiPropertyOptional({ description: 'Active (true) or paused (false)' }) @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Only plans due later (nextRunAt in the future)' }) @IsOptional() @Type(() => Boolean) @IsBoolean() upcoming?: boolean;
  @ApiPropertyOptional({ description: 'Only active plans already due (nextRunAt in the past)' }) @IsOptional() @Type(() => Boolean) @IsBoolean() overdue?: boolean;
}
