import { IsOptional, IsUUID, IsEnum, IsString } from 'class-validator';
import { StudentStatus } from '../entities/student.entity';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Sprint 1 — Feature 5: page/limit moved to PaginationQueryDto (identical
// validators, pure extraction — see that file's comment). Behavior
// unchanged: normalizePagination()/wantsPaginatedResponse() in
// StudentsService still gate on the same fields.
export class QueryStudentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  search?: string; // matches against full_name
}
