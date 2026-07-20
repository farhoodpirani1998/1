import { IsEnum, IsOptional } from 'class-validator';
import { HomeworkSubmissionStatus } from '../../homework/entities/homework-submission.entity';

// Sprint A.3.3 — backs GET /teacher/homework/:id/submissions. Optional
// narrowing filter only -- omitted entirely, every submission row for
// the homework is returned, same "optional filter(s), no filter means
// everything the caller is allowed to see" convention as
// QueryTeacherAttendanceDto / QueryHomeworkDto.
export class QueryTeacherHomeworkSubmissionsDto {
  @IsOptional()
  @IsEnum(HomeworkSubmissionStatus)
  status?: HomeworkSubmissionStatus;
}
