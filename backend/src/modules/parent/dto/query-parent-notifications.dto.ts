import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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

export class QueryParentNotificationsDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isRead?: boolean;

  // Same pagination pattern as QueryInstallmentsDto/QueryStudentsDto —
  // defaults/ceiling applied via normalizePagination() in ParentService.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
