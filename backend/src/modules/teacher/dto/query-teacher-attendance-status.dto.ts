import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Sprint A.1: backs GET /teacher/attendance/status -- same
// gradeId/classId narrowing contract as QueryTeacherAttendanceDto, plus
// an optional `date` (defaults to today in TeacherService, same
// "explicit date, or today if the caller doesn't say otherwise"
// convention as GET /teacher/attendance/today vs .../date/:date).
export class QueryTeacherAttendanceStatusDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;
}
