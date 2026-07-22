import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementPriority, AnnouncementStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Community the announcement is for' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiProperty({ example: 'Water supply interruption on Sunday' })
  @IsString() @MinLength(2) @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString() @MinLength(1) @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({ enum: AnnouncementPriority, default: AnnouncementPriority.NORMAL })
  @IsOptional() @IsEnum(AnnouncementPriority) priority?: AnnouncementPriority;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'When to auto-publish (optional)' })
  @IsOptional() @Type(() => Date) publishAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'When it auto-expires (optional)' })
  @IsOptional() @Type(() => Date) expiresAt?: Date;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(8000) content?: string;
  @ApiPropertyOptional({ enum: AnnouncementPriority }) @IsOptional() @IsEnum(AnnouncementPriority) priority?: AnnouncementPriority;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) publishAt?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) @IsOptional() @Type(() => Date) expiresAt?: Date;
}

export class QueryAnnouncementDto extends ListQueryDto {
  @ApiProperty({ description: 'Community to list announcements for (required — tenant scope)' })
  @IsString() @MinLength(1)
  communityId!: string;

  @ApiPropertyOptional({ enum: AnnouncementPriority }) @IsOptional() @IsEnum(AnnouncementPriority) priority?: AnnouncementPriority;
  @ApiPropertyOptional({ enum: AnnouncementStatus }) @IsOptional() @IsEnum(AnnouncementStatus) status?: AnnouncementStatus;
  @ApiPropertyOptional({ description: 'Only currently-visible published announcements' })
  @IsOptional() @Type(() => Boolean) publishedOnly?: boolean;
}
