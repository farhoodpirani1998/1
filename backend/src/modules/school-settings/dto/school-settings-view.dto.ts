import { SchoolSettings } from '../entities/school-settings.entity';
import { Weekday } from '../../timetable/entities/timetable-entry.entity';

// school_admin-facing shape: the full record, minus the raw `school`
// relation object TypeORM would otherwise attach -- same "reshape,
// don't leak the ORM entity as-is" reasoning as toHomeworkView /
// toTimetableEntryView elsewhere.
export interface SchoolSettingsView {
  schoolId: string;
  schoolName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  language: string;
  currency: string;
  weekStartsOn: Weekday;
  workingDays: Weekday[];
  passingScore: number;
  attendanceLateMinutes: number;
  tuitionReminderDays: number;
  smsEnabled: boolean;
  emailEnabled: boolean;
  primaryColor: string | null;
  secondaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSchoolSettingsView(settings: SchoolSettings): SchoolSettingsView {
  return {
    schoolId: settings.schoolId,
    schoolName: settings.schoolName,
    logoUrl: settings.logoUrl,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    timezone: settings.timezone,
    language: settings.language,
    currency: settings.currency,
    weekStartsOn: settings.weekStartsOn,
    workingDays: settings.workingDays,
    passingScore: Number(settings.passingScore),
    attendanceLateMinutes: settings.attendanceLateMinutes,
    tuitionReminderDays: settings.tuitionReminderDays,
    smsEnabled: settings.smsEnabled,
    emailEnabled: settings.emailEnabled,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}
