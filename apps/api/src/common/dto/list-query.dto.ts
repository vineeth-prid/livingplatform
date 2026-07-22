import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from './pagination.dto';

export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

/**
 * Base query for list endpoints: pagination + free-text search + sorting.
 * Services whitelist which `sortBy` fields are allowed (never trust the client
 * to name an arbitrary column) via `resolveSort`.
 */
export class ListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Field to sort by (whitelisted per resource)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.Desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDir?: SortDirection;
}

/**
 * Turn a client's `sortBy`/`sortDir` into a safe Prisma orderBy, rejecting any
 * field not in `allowed`.
 */
export function resolveSort<T extends string>(
  query: ListQueryDto,
  allowed: readonly T[],
  fallback: T,
): Record<string, 'asc' | 'desc'> {
  const field =
    query.sortBy && (allowed as readonly string[]).includes(query.sortBy)
      ? query.sortBy
      : fallback;
  const dir = query.sortDir === SortDirection.Asc ? 'asc' : 'desc';
  return { [field]: dir };
}
