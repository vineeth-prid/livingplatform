import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Shared: get a signed upload URL for an asset document/photo (StorageService). */
export class RequestAssetUploadUrlDto {
  @ApiProperty({ example: 'dg-nameplate.jpg' })
  @IsString() @MinLength(1) @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional() @IsString() @MaxLength(120)
  contentType?: string;
}

export class CreateAssetDocumentDto {
  @ApiProperty({ example: 'warranty-card.pdf' })
  @IsString() @MinLength(1) @MaxLength(255)
  fileName!: string;

  @ApiProperty({ description: 'Storage key from the upload-url endpoint' })
  @IsString() @MinLength(1)
  storageKey!: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional() @IsString() @MaxLength(120)
  mimeType?: string;
}

export class CreateAssetPhotoDto {
  @ApiProperty({ description: 'Storage key from the upload-url endpoint' })
  @IsString() @MinLength(1)
  storageKey!: string;

  @ApiPropertyOptional({ example: 'Nameplate — serial visible' })
  @IsOptional() @IsString() @MaxLength(300)
  caption?: string;
}
