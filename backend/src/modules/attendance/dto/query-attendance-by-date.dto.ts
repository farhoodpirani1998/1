import { IsOptional, IsUUID } from 'class-validator';

// The date itself is a path param (validated in AttendanceService.findByDate,
// same "reject a malformed value with 400 before it ever reaches a query"
// shape as the rest of this DTO's siblings, just not expressible as a path
// param via class-validator). These are the only optional narrowing filters
// on top of it.
export class QueryAttendanceByDateDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
