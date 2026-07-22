import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DocumentCategory, DocumentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateDocumentDto {
  @ApiProperty({ example: 'Association Bylaws 2026' })
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: DocumentCategory, default: DocumentCategory.OTHER })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  // Storage metadata — storageKey comes from the upload-url flow (or stays null).
  @ApiPropertyOptional() @IsOptional() @IsString() storageKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) mimeType?: string;

  @ApiPropertyOptional({ description: 'Bytes' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({ example: 'v1.0' })
  @IsOptional() @IsString() @MaxLength(40)
  version?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date)
  issuedOn?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date)
  expiresOn?: Date;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

export class QueryDocumentDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional() @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class RequestUploadUrlDto {
  @ApiProperty({ example: 'bylaws-2026.pdf' })
  @IsString() @MinLength(1) @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional() @IsString() @MaxLength(120)
  contentType?: string;
}
