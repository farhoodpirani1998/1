import { TimetableEntry } from '../entities/timetable-entry.entity';

// school_admin-facing shape: the full record, minus the raw relation
// objects TypeORM would otherwise attach (school, academicYear) -- same
// "reshape, don't leak the ORM entity as-is" reasoning as toAssessmentView
// / toAttendanceView elsewhere. gradeTitle/subjectTitle/teacherName are
// only populated when the caller eager-loaded those relations (every read
// path in this module does), same convention as AssessmentView.subjectTitle.
export interface TimetableEntryView {
  id: string;
  academicYearId: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
  teacherId: string;
  teacherName?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTimetableEntryView(entry: TimetableEntry): TimetableEntryView {
  return {
    id: entry.id,
    academicYearId: entry.academicYearId,
    gradeId: entry.gradeId,
    gradeTitle: entry.grade?.title,
    subjectId: entry.subjectId,
    subjectTitle: entry.subject?.title,
    teacherId: entry.teacherId,
    teacherName: entry.teacher?.fullName,
    weekday: entry.weekday,
    // Postgres TIME columns read back as 'HH:MM:SS' regardless of what
    // was written -- always trimmed to 'HH:MM' here so the API surface
    // matches exactly what CreateTimetableEntryDto/UpdateTimetableEntryDto
    // accept, in both directions.
    startTime: entry.startTime.slice(0, 5),
    endTime: entry.endTime.slice(0, 5),
    room: entry.room,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

// Recipient-facing shape (teacher/parent): same fields, minus nothing in
// particular here -- unlike AnnouncementView/AssessmentView there's no
// internal-only column (no "createdById") on TimetableEntry, so the
// recipient view and the admin view carry the same information. Kept as
// its own named type/function anyway, same "one mapper per call site"
// convention as toRecipientAnnouncementView / toParentAssessmentView, so
// a future admin-only field (e.g. an internal note) can be added to
// TimetableEntryView without silently leaking into a recipient's response.
export type RecipientTimetableEntryView = TimetableEntryView;

export function toRecipientTimetableEntryView(entry: TimetableEntry): RecipientTimetableEntryView {
  return toTimetableEntryView(entry);
}
