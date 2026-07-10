import { IsOptional, IsUUID } from 'class-validator';

// Optional narrowing filters on GET /homework (school_admin) and
// GET /teacher/homework -- omitted entirely, each returns every row the
// caller is allowed to see. Same convention as QueryTimetableDto /
// QueryTeacherStudentsDto.
export class QueryHomeworkDto {
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
