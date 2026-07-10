import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

// Phase 5N: Global Search.
//
// `q` is the only required input -- a free-text term matched
// case-insensitively and partially (ILIKE '%term%') against each
// searched entity's name/title fields (see SearchService). `limit`
// caps how many rows come back *per category*, not overall -- same
// "one shared cap applied independently to every group" shape a
// combined-search response needs, since a caller asking for `limit=10`
// expects up to 10 students AND up to 10 parents AND so on, not 10
// results split across six categories.
export class QuerySearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  q: string;

  // Deliberately its own small range (default 10, max 50) rather than
  // reusing common/utils/pagination.ts's DEFAULT_PAGE_LIMIT/MAX_PAGE_LIMIT
  // (50/200) -- those were sized for a single paginated list endpoint;
  // global search fans out across six queries per request, so a much
  // smaller ceiling per category keeps the endpoint cheap even with a
  // very broad search term.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
