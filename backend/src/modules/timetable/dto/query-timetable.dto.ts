import { IsOptional, IsUUID } from 'class-validator';

// Optional narrowing filters on GET /timetable -- omitted entirely, it
// returns every entry in the caller's own school. Same convention as
// QueryAttendanceByDateDto / QueryTeacherStudentsDto.
export class QueryTimetableDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
