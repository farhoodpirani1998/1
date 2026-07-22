import { IsOptional, IsEnum, IsUUID, IsDateString, IsString, MaxLength } from 'class-validator';
import { AuditAction } from '../audit-log.entity';
import { PaginationQueryDto } from '../../dto/pagination-query.dto';

/**
 * GET /audit-logs filters. page/limit come from PaginationQueryDto (same
 * extraction pattern as QueryInstallmentsDto etc.) — defaults/ceiling are
 * applied in AuditService.findWithFilters() via normalizePagination(), not
 * here.
 *
 * Deliberately no `schoolId` field on this DTO: tenant scoping is derived
 * server-side from the authenticated user (@CurrentUser('schoolId') for
 * school_admin, unset for super_admin) in AuditController, never trusted
 * from the query string — same reasoning as the schoolId comment on
 * QueryInstallmentsDto, just enforced here rather than merely documented,
 * since audit rows are more sensitive than installments.
 */
export class QueryAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  // Inclusive lower bound on created_at. Validated as an ISO date string,
  // same @IsDateString() convention as CreateAttendanceDto/AddInstallmentDto
  // etc.; parsed to a Date only in the service layer.
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  // Inclusive upper bound on created_at.
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
