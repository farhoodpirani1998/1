import { IsOptional, IsEnum, IsUUID, IsString, MaxLength } from 'class-validator';
import { InstallmentStatus } from '../entities/installment.entity';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Sprint 1 — Feature 5: page/limit moved to PaginationQueryDto (pure
// extraction, same validators — defaults/ceiling still applied in
// InstallmentsService via normalizePagination()).
export class QueryInstallmentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InstallmentStatus)
  status?: InstallmentStatus;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  // Phase 4B: matches against the joined student's fullName. Previously
  // InstallmentsPage did this client-side over whatever page it already
  // had in memory (fine when every row was fetched at once under the
  // old capped-but-unpaginated load; not fine once the list is really
  // paginated server-side, since a name match on page 3 would otherwise
  // never be seen).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // schoolId is normally injected from the authenticated user's JWT via
  // the TenantGuard/CurrentUser decorator rather than trusted from the
  // query string — kept here only for clarity of the filter shape.
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
