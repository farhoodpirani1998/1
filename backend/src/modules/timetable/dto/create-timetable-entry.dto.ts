import { IsUUID, IsEnum, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { Weekday } from '../entities/timetable-entry.entity';

// 24-hour 'HH:MM', same "reject at the DTO boundary, not deep in the
// service" convention CreateAttendanceDto's @IsDateString() follows.
// TimetableService is the one that additionally checks startTime < endTime
// (a cross-field rule class-validator can't express with a single
// decorator) and that the range doesn't overlap another entry.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTimetableEntryDto {
  @IsUUID()
  academicYearId: string;

  @IsUUID()
  gradeId: string;

  @IsUUID()
  subjectId: string;

  @IsUUID()
  teacherId: string;

  @IsEnum(Weekday)
  weekday: Weekday;

  @Matches(TIME_PATTERN, { message: 'startTime باید به فرمت HH:MM باشد' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime باید به فرمت HH:MM باشد' })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  room?: string;
}
