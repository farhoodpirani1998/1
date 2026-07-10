import { IsUUID } from 'class-validator';

// school_admin-only (see TeacherController.assign). schoolId is never
// taken from the body — it's always the caller's own schoolId, same
// convention as LinkParentDto/ParentService.link.
export class CreateTeacherAssignmentDto {
  @IsUUID()
  teacherId: string;

  @IsUUID()
  gradeId: string;

  @IsUUID()
  subjectId: string;
}
