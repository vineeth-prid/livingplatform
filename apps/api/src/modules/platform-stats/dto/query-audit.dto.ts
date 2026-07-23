import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class QueryAuditDto extends ListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by module/resource' })
  @IsOptional() @IsString() resource?: string;

  @ApiPropertyOptional({ description: 'Filter by action (contains)' })
  @IsOptional() @IsString() action?: string;

  @ApiPropertyOptional({ enum: ['ok', 'fail'] })
  @IsOptional() @IsIn(['ok', 'fail']) status?: 'ok' | 'fail';

  @ApiPropertyOptional({ description: 'ISO date lower bound' })
  @IsOptional() @IsString() from?: string;

  @ApiPropertyOptional({ description: 'ISO date upper bound' })
  @IsOptional() @IsString() to?: string;
}
