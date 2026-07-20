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

  // Optional: scopes this assignment to one section of the grade
  // instead of the entire grade. Left out, TeacherService.assign() then
  // stores classId as NULL, meaning "this teacher covers every section
  // of this grade" -- the pre-existing behavior, unchanged for any
  // school that doesn't split a grade into sections.
  @IsOptional()
  @IsUUID()
  classId?: string;
}
