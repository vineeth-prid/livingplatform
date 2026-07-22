import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Technician scheduled for tomorrow 11:00 AM.' })
  @IsString() @MinLength(1) @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Internal comments are visible only to staff/admin',
  })
  @IsOptional() @IsBoolean()
  isInternal?: boolean;
}
