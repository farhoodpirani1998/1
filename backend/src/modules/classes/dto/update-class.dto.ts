import { IsString, MaxLength } from 'class-validator';

// gradeId/academicYearId are deliberately not editable here -- moving a
// class to a different grade or year would orphan every student/
// teacher-assignment row already pointing at it under the old
// (grade, year) pair. A class that needs to move is deleted and
// re-created instead, same as Grade offers no way to re-point its
// school_id either.
export class UpdateClassDto {
  @IsString()
  @MaxLength(50)
  title: string;
}
