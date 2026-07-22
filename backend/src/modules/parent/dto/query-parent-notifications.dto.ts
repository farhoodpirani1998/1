import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * `isRead` arrives over the query string as the literal text "true"/
 * "false" (or is absent) — never an actual boolean. class-validator's
 * @IsBoolean() only accepts a real boolean, and naively coercing with
 * something like `Boolean(value)` is wrong here: Boolean('false') is
 * `true`, since any non-empty string is truthy. The @Transform below
 * maps the two accepted literal strings to real booleans *before*
 * validation runs, and leaves anything else (including "isRead" being
 * omitted) alone so @IsOptional()/@IsBoolean() correctly reject garbage
 * like ?isRead=maybe instead of silently passing it through.
 */
const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

// Sprint 1 — Feature 5: page/limit moved to PaginationQueryDto (pure
// extraction, same validators — defaults/ceiling still applied via
// normalizePagination() in ParentService).
export class QueryParentNotificationsDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isRead?: boolean;
}
