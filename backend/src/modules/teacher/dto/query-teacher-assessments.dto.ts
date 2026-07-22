import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// Sprint A.2: narrows GET /teacher/assessments to one of the teacher's
// assigned (grade, class, subject) scopes, same "rejected if it isn't
// one of the teacher's own assignments, never silently ignored" contract
// as QueryTeacherAttendanceDto (Sprint A.1) -- gradeId/classId/subjectId
// mirror that DTO's shape, extended with studentId (narrows to one
// student within scope) and fromDate/toDate (see
// AssessmentsService.findForScope: filtered against
// Assessment.createdAt, since assessments have no date column of their
// own -- only term).
//
// Sprint 1 Feature 5: extends PaginationQueryDto for the same optional
// page/limit every other list endpoint now takes -- omitted entirely,
// the response stays the existing plain array.
export class QueryTeacherAssessmentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
