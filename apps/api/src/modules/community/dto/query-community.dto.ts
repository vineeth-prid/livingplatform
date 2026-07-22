import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommunityStatus, CommunityType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class QueryCommunityDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: CommunityType })
  @IsOptional()
  @IsEnum(CommunityType)
  type?: CommunityType;

  @ApiPropertyOptional({ enum: CommunityStatus })
  @IsOptional()
  @IsEnum(CommunityStatus)
  status?: CommunityStatus;
}
