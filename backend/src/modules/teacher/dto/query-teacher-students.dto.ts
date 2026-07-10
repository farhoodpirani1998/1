import { IsOptional, IsUUID } from 'class-validator';

// Narrows GET /teacher/students to one of the teacher's assigned grades.
// Omitted entirely, it returns students across every grade the teacher is
// assigned to (see TeacherService.findMyStudents) -- the gradeId, if
// given, must still be one of the teacher's own assignments or it's
// rejected the same way an unassigned grade is everywhere else in this
// module (Forbidden), never silently ignored.
export class QueryTeacherStudentsDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;
}
