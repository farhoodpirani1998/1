import { IsOptional, IsUUID } from 'class-validator';

// Sprint A.1: narrows GET /teacher/attendance/today and
// GET /teacher/attendance/date/:date to one of the teacher's assigned
// grades/classes -- same "rejected if it isn't one of the teacher's own
// assignments, never silently ignored" contract as
// QueryTeacherStudentsDto, which this deliberately mirrors rather than
// reuses: it documents the attendance-read routes on their own terms and
// can grow independently of the students-roster query (see
// QueryTeacherAttendanceStatusDto below, which adds `date`).
export class QueryTeacherAttendanceDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;
}
