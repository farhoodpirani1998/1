import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Optional narrowing filters on GET /homework (school_admin) and
// GET /teacher/homework -- omitted entirely, each returns every row the
// caller is allowed to see. Same convention as QueryTimetableDto /
// QueryTeacherStudentsDto.
//
// Sprint 1 — Feature 5: extends PaginationQueryDto for optional
// page/limit -- gated the same way as QueryStudentsDto: omitted entirely,
// callers keep getting the plain array they always have.
export class QueryHomeworkDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
