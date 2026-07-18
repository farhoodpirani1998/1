import { IsUUID, IsOptional } from 'class-validator';

// school_admin-only (see TeacherController.assign). schoolId is never
// taken from the body — it's always the caller's own schoolId, same
// convention as LinkParentDto/ParentService.link.
export class CreateTeacherAssignmentDto {
  @IsUUID()
  teacherId: string;

  @IsUUID()
  gradeId: string;

  // Optional: elementary grades (پایه ابتدایی) don't split instruction by
  // subject, so this may be left out entirely -- TeacherService.assign()
  // then stores subjectId as NULL, meaning "this teacher covers every
  // subject for this grade" (see the migration for the DB-level
  // constraint change this relies on).
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
