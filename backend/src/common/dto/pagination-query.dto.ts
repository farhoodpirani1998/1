import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Sprint 1 — Feature 5: shared base for the `page`/`limit` fields that were
 * previously copy-pasted (identical decorators) across QueryStudentsDto,
 * QueryGuardiansDto, QueryInstallmentsDto, and QueryParentNotificationsDto.
 *
 * Fields/validators are unchanged from those DTOs — this is a pure
 * extraction, not a behavior change. Pair with normalizePagination() /
 * wantsPaginatedResponse() (src/common/utils/pagination.ts) in the service
 * layer, same as before.
 */
export class PaginationQueryDto {
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
