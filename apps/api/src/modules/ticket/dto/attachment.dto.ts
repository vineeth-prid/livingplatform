import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { WorkEvidenceStage } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class RequestAttachmentUploadUrlDto {
  @ApiProperty({ example: 'leak-photo.jpg' })
  @IsString() @MinLength(1) @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional() @IsString() @MaxLength(120)
  contentType?: string;
}

export class CreateAttachmentDto {
  @ApiProperty({ example: 'leak-photo.jpg' })
  @IsString() @MinLength(1) @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString() @MinLength(1) @MaxLength(120)
  contentType!: string;

  @ApiProperty({ example: 248901, description: 'Bytes' })
  @Type(() => Number) @IsInt() @Min(0)
  size!: number;

  @ApiProperty({ description: 'Storage key returned by the upload-url endpoint' })
  @IsString() @MinLength(1)
  storageKey!: string;

  /**
   * Marks the photo as site evidence. BEFORE is required to start work and
   * AFTER to resolve; omit for an ordinary attachment.
   */
  @ApiPropertyOptional({ enum: WorkEvidenceStage })
  @IsOptional() @IsEnum(WorkEvidenceStage)
  stage?: WorkEvidenceStage;
}
