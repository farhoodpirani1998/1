import { IsUUID, IsEnum, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { Weekday } from '../entities/timetable-entry.entity';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Every field optional, same hand-written "partial DTO" convention as
// UpdateStudentDto / UpdateAcademicYearDto (no @nestjs/mapped-types
// dependency in this codebase). TimetableService.update() merges
// whichever fields are given onto the existing row, then re-runs the
// same assignment + overlap checks create() runs, against the merged
// result -- so a partial update can never land in an invalid state
// create() would have rejected outright.
export class UpdateTimetableEntryDto {
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
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsEnum(Weekday)
  weekday?: Weekday;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime باید به فرمت HH:MM باشد' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime باید به فرمت HH:MM باشد' })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  room?: string;
}
