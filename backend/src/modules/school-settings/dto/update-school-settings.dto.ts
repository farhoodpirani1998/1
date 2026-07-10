import {
  IsString,
  IsOptional,
  MaxLength,
  IsUrl,
  IsEmail,
  IsIn,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsPhoneNumber,
  Matches,
} from 'class-validator';
import { Weekday } from '../../timetable/entities/timetable-entry.entity';

// Every field optional -- same hand-written "partial DTO" convention as
// UpdateTimetableEntryDto / UpdateHomeworkDto (no @nestjs/mapped-types
// dependency in this codebase). SchoolSettingsService.update() merges
// whichever fields the caller provides onto the school's existing (or
// freshly defaulted) settings row; omitted fields are left unchanged.
//
// Nullable-via-null fields (logoUrl, address, phone, email, website,
// primaryColor, secondaryColor) let a caller explicitly clear a
// previously-set value -- same "omit to leave unchanged, null to clear"
// shape UpdateHomeworkDto.attachmentUrl already uses.
export class UpdateSchoolSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2000)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsPhoneNumber('IR')
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(255)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  // Kept to the two locales this system actually supports today (see
  // SchoolSettingsService's default of 'fa') -- a free-text locale string
  // could otherwise drift out of sync with what the frontend actually
  // ships translations for.
  @IsOptional()
  @IsIn(['fa', 'en'])
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsEnum(Weekday)
  weekStartsOn?: Weekday;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  workingDays?: Weekday[];

  // Out of 20, the standard Iranian school scale (see
  // Assessment.maxScore's default) -- 0 allows "no minimum enforced",
  // 20 is the ceiling of that scale.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  passingScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  attendanceLateMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  tuitionReminderDays?: number;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primaryColor must be a hex color, e.g. #1A73E8',
  })
  primaryColor?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'secondaryColor must be a hex color, e.g. #1A73E8',
  })
  secondaryColor?: string | null;
}
