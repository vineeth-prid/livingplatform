import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

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
}
