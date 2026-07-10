import { IsUUID, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AssessmentTerm } from '../entities/assessment.entity';

export class CreateAssessmentDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  subjectId: string;

  @IsEnum(AssessmentTerm)
  term: AssessmentTerm;

  @IsNumber()
  @Min(0)
  score: number;

  // Defaults to 20 (see Assessment.maxScore) when omitted -- validated in
  // AssessmentsService.record() against `score` (score must not exceed
  // maxScore), same "reject an inconsistent value with 400 before it ever
  // reaches a query" shape as AttendanceService's date-format check.
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
