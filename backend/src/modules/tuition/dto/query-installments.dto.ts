import { IsOptional, IsEnum, IsUUID } from 'class-validator';
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
}
