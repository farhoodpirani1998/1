// ---------------------------------------------------------------------
// "کپی از جلسه قبل" — TEMPORARY MOCK.
//
// TeacherAttendancePage has no way to read a past day's attendance for a
// grade: there is no GET-by-date route wired into TeacherController (the
// backend attendance module has query-attendance-by-date.dto.ts, but it's
// only exposed on the school_admin-facing AttendanceController, not the
// teacher-facing one — see TeacherAttendancePage.tsx's own TODO at the
// bottom of that file, "no GET-by-date route wired into the frontend
// yet"). So "copy the previous session's marks onto today" has nothing
// real to copy from yet.
//
// Seeded deterministically per studentId (not per grade/date — the page
// doesn't have a reliable "previous session" boundary to key off without
// a real history endpoint), so the same student always gets the same
// mock "last time" status within a session, instead of reshuffling on
// every click.
//
// TODO(backend): once GET /teacher/attendance?date=... (or similar)
// exists, replace this file's body with a real api.get() call that finds
// the most recent prior date with records for the grade and returns
// those — TeacherAttendancePage's "کپی از جلسه قبل" button already calls
// this through the same async function signature, so only this file
// changes.
// ---------------------------------------------------------------------

import type { AttendanceDisplayStatus } from '../types/attendanceExtras.types';

const MOCK_NETWORK_DELAY_MS = 300;

const MOCK_ROTATION: AttendanceDisplayStatus[] = [
  'present',
  'present',
  'present',
  'present',
  'late',
  'quick_absent',
  'excused_absent',
];

export async function getPreviousSessionAttendance(
  studentIds: string[],
): Promise<Record<string, AttendanceDisplayStatus>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));

  const result: Record<string, AttendanceDisplayStatus> = {};
  for (const studentId of studentIds) {
    let seed = 0;
    for (let i = 0; i < studentId.length; i++) seed = (seed * 31 + studentId.charCodeAt(i)) >>> 0;
    result[studentId] = MOCK_ROTATION[seed % MOCK_ROTATION.length];
  }
  return result;
}
