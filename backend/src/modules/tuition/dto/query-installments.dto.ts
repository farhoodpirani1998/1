import { IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InstallmentStatus } from '../entities/installment.entity';

export class QueryInstallmentsDto {
  @IsOptional()
  @IsEnum(InstallmentStatus)
  status?: InstallmentStatus;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  // schoolId is normally injected from the authenticated user's JWT via
  // the TenantGuard/CurrentUser decorator rather than trusted from the
  // query string — kept here only for clarity of the filter shape.
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  // Phase 4A: pagination — see QueryStudentsDto for the same pattern;
  // defaults/ceiling applied in InstallmentsService via
  // normalizePagination().
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
