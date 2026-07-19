// ---------------------------------------------------------------------
// Extended attendance status set requested in review of the teacher
// attendance page: حاضر / غایب / تأخیر / مرخصی / غیبت موجه / غیبت غیرموجه.
// «غایب» is a quick, unresolved mark (per review: eventually resolved to
// موجه or غیرموجه), not its own persisted meaning — so 6 buttons, but
// only 5 "real" outcomes underneath.
//
// The real backend enum (AttendanceStatus on attendance.entity.ts) only
// has 4 values — present / absent / late / excused — and
// CreateAttendanceDto validates status with @IsEnum() against exactly
// those 4, so a 5th/6th value would be rejected outright. Per review,
// the backend/enum is NOT changed this pass. Instead:
//
//   - «حاضر» / «تأخیر» / «غیبت موجه» map 1:1 onto the existing
//     present/late/excused values — nothing new needed for these three.
//   - «غایب» (quick, unresolved) and «غیبت غیرموجه» both map onto the
//     existing `absent` value — the backend has no room to tell them
//     apart.
//   - «مرخصی» maps onto the existing `excused` value, for the same
//     reason — closest real status a leave should read as.
//
// Where a display status maps onto a backend value that doesn't fully
// capture it (مرخصی → excused, غیبت غیرموجه → absent), DISPLAY_STATUS_TAG
// below gives a short Persian tag that TeacherAttendancePage.tsx prepends
// to the row's `note` field — a real, already-persisted column — so the
// finer distinction survives a save instead of being silently lost. This
// needs no mock store and no backend change; see the "note tag" handling
// in TeacherAttendancePage.tsx's handleSaveAll.
// ---------------------------------------------------------------------

import type { AttendanceStatusValue } from '../api/teacher.api';

export type AttendanceDisplayStatus =
  | 'present'
  | 'late'
  | 'quick_absent'
  | 'leave'
  | 'excused_absent'
  | 'unexcused_absent';

export const ATTENDANCE_DISPLAY_OPTIONS: { value: AttendanceDisplayStatus; label: string }[] = [
  { value: 'present', label: 'حاضر' },
  { value: 'quick_absent', label: 'غایب' },
  { value: 'late', label: 'تأخیر' },
  { value: 'leave', label: 'مرخصی' },
  { value: 'excused_absent', label: 'غیبت موجه' },
  { value: 'unexcused_absent', label: 'غیبت غیرموجه' },
];

export const DISPLAY_STATUS_LABEL: Record<AttendanceDisplayStatus, string> = Object.fromEntries(
  ATTENDANCE_DISPLAY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AttendanceDisplayStatus, string>;

// نگاشت به مقدار واقعی enum بک‌اند — همان مقداری که در POST واقعی ارسال می‌شود.
export const DISPLAY_TO_BACKEND_STATUS: Record<AttendanceDisplayStatus, AttendanceStatusValue> = {
  present: 'present',
  late: 'late',
  quick_absent: 'absent',
  leave: 'excused',
  excused_absent: 'excused',
  unexcused_absent: 'absent',
};

// فقط برای دو وضعیتی که با مقدار واقعی‌شان هم‌معنا نیستند — بقیه نیازی
// به برچسب اضافه در یادداشت ندارند چون همان‌قدر که enum واقعی می‌گوید
// کافی است.
export const DISPLAY_STATUS_TAG: Partial<Record<AttendanceDisplayStatus, string>> = {
  leave: 'مرخصی',
  unexcused_absent: 'غیبت غیرموجه',
};

export const DISPLAY_STATUS_BADGE_CLASS: Record<AttendanceDisplayStatus, string> = {
  present: 'bg-paid/10 text-paid border-paid/25',
  late: 'bg-action-soft text-action border-action/25',
  quick_absent: 'bg-overdue/10 text-overdue border-overdue/25',
  leave: 'bg-ink/5 text-ink/60 border-line dark:bg-white/5 dark:text-paper/60 dark:border-white/10',
  excused_absent: 'bg-ink/5 text-ink/60 border-line dark:bg-white/5 dark:text-paper/60 dark:border-white/10',
  unexcused_absent: 'bg-overdue/10 text-overdue border-overdue/30',
};
