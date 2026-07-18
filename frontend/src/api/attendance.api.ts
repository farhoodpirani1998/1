import { api } from '../lib/api';

// Sprint 2 (Educational Operations): whole-school attendance-by-date view.
// Matches AttendanceController on the backend
// (backend/src/modules/attendance/attendance.controller.ts) —
// POST /attendance, GET /attendance/student/:id, GET /attendance/date/:date.
// @Roles('school_admin', 'accountant', 'staff') on every route below —
// distinct from teacher.api.ts's recordAttendance() (POST
// /teacher/attendance, @Roles('teacher'), a teacher marking their own
// class), even though both ultimately write the same `attendance` table.

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  academicYearId: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  recordedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueryAttendanceByDateParams {
  gradeId?: string;
  academicYearId?: string;
}

// GET /attendance/date/:date — every attendance record for the caller's
// school on one calendar day (ISO 'YYYY-MM-DD'), optionally narrowed by
// grade/academic year.
export function getAttendanceByDate(date: string, params?: QueryAttendanceByDateParams) {
  return api.get<AttendanceRecord[]>(`/attendance/date/${date}`, { params });
}

export function getAttendanceByStudent(studentId: string) {
  return api.get<AttendanceRecord[]>(`/attendance/student/${studentId}`);
}

// Matches CreateAttendanceDto. Upserts on (studentId, date) on the
// backend — correcting a mark already taken for that day is a second
// POST with the same studentId/date, not a separate "edit" route.
export interface RecordAttendanceInput {
  studentId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
}
export function recordAttendance(dto: RecordAttendanceInput) {
  return api.post<AttendanceRecord>('/attendance', dto);
}
