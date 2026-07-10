import { IsUUID, IsString, IsNotEmpty, MaxLength, IsDateString, IsOptional, IsUrl } from 'class-validator';

// teacherId is deliberately NOT a field here -- it's always the calling
// teacher (CurrentUser), same "derived from the token, never taken from
// the body" reasoning as TeacherController.recordAttendance /
// recordAssessment never accepting a teacherId in their DTOs either.
// HomeworkService checks the caller holds a TeacherAssignment for the
// exact (gradeId, subjectId) pair before creating the row.
export class CreateHomeworkDto {
  @IsUUID()
  academicYearId: string;

  @IsUUID()
  gradeId: string;

  @IsUUID()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  // 'YYYY-MM-DD', same convention CreateAttendanceDto's @IsDateString()
  // follows.
  @IsDateString()
  dueDate: string;

  // Phase 5L does not implement file storage/upload -- the caller supplies
  // the already-hosted location of the file, same shape as
  // CreateStudentDocumentDto.fileUrl (require_tld: false so
  // http://localhost/... URLs used in dev/tests still pass).
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2000)
  attachmentUrl?: string;
}
