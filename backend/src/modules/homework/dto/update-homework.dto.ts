import { IsUUID, IsString, IsNotEmpty, MaxLength, IsDateString, IsOptional, IsUrl } from 'class-validator';

// Every field optional, same hand-written "partial DTO" convention as
// UpdateTimetableEntryDto / UpdateStudentDto (no @nestjs/mapped-types
// dependency in this codebase). HomeworkService.update() merges whichever
// fields are given onto the existing row, then re-runs the same
// relation/assignment checks create() runs, against the merged result --
// so a partial update can never land in a state create() would have
// rejected outright.
export class UpdateHomeworkDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // Explicitly nullable-via-null so a caller can clear a previously-set
  // attachment; omitting the field entirely leaves it unchanged (see
  // HomeworkService.update()).
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2000)
  attachmentUrl?: string | null;
}
