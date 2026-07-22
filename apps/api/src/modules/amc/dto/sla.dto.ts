import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class CreateSlaRuleDto {
  @ApiProperty({ enum: TicketPriority })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @ApiProperty({ example: 60, description: 'Minutes to first response' })
  @Type(() => Number) @IsInt() @Min(1)
  responseTimeMinutes!: number;

  @ApiProperty({ example: 240, description: 'Minutes to resolution' })
  @Type(() => Number) @IsInt() @Min(1)
  resolutionTimeMinutes!: number;

  @ApiPropertyOptional({ example: 120, description: 'Minutes before escalation' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) escalationAfterMinutes?: number;
}

export class UpdateSlaRuleDto {
  @ApiPropertyOptional({ enum: TicketPriority }) @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) responseTimeMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) resolutionTimeMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) escalationAfterMinutes?: number;
}
