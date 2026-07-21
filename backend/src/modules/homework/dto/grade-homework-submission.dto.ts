import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Sprint H3.0 — backs PATCH /teacher/homework/submissions/:submissionId.
//
// `score` is required and validated as a non-negative integer here --
// the same "reject an inconsistent value with 400 before it ever
// reaches a query" shape CreateAssessmentDto/AttendanceService already
// use. The upper bound is NOT enforced in this DTO: unlike
// Assessment (which always carries its own maxScore column),
// Homework does not have a maxScore field today (see the Homework
// entity) -- so there is nothing fixed for class-validator to check
// against. HomeworkSubmissionService.gradeSubmission() re-validates
// `score` against `homework.maxScore` if/when that field exists on the
// resolved Homework row (a plain runtime property check, not a
// TypeScript-typed one, so this validation activates automatically the
// moment that column is added, with no DTO change needed here) --
// until then, only the >= 0 floor below applies, exactly the "otherwise
// validate >=0 only" fallback this sprint asks for.
export class GradeHomeworkSubmissionDto {
  @IsInt()
  @Min(0)
  score: number;

  // Optional: omitting `feedback` leaves any previously-stored feedback
  // unchanged (see gradeSubmission()); passing an empty string clears
  // it. Trimmed before validation/storage, same "trim strings" rule
  // this sprint calls for -- a value that is only whitespace is
  // trimmed down to '' and stored as such, not rejected, mirroring
  // how every other optional free-text field in this codebase (e.g.
  // Assessment.note) is treated.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
