import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { CreateCommunityDto } from './create-community.dto';

/** All community fields become optional on update (code/slug remain unique). */
export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}

export class LogoUploadUrlDto {
  @ApiProperty({ example: 'logo.png' }) @IsString() @MinLength(1) @MaxLength(200) fileName!: string;
  @ApiProperty({ example: 'image/png', enum: ['image/png', 'image/jpeg', 'image/webp'] })
  @IsIn(['image/png', 'image/jpeg', 'image/webp'], { message: 'Upload a PNG, JPG or WebP image' }) contentType!: string;
}

export class SetLogoDto {
  @ApiProperty({ description: 'Key returned by the logo upload-url endpoint' }) @IsString() @MaxLength(500) key!: string;
}
