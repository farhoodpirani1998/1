import { api } from '../lib/api';

// Sprint 2 (Educational Operations): weekly class schedule management.
// Matches TimetableController on the backend
// (backend/src/modules/timetable/timetable.controller.ts) —
// POST/GET/PUT/DELETE /timetable, @Roles('school_admin'). Distinct from
// teacher.api.ts's getTimetable() (GET /teacher/timetable, the signed-in
// teacher's own read-only view) and parent's grade-scoped read — both of
// those reuse the same TimetableEntry rows this page manages.

// weekday follows the backend's Weekday enum (0 = Saturday ... 6 = Friday,
// the Iranian school week).
export interface TimetableEntry {
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
  createdAt: string;
  updatedAt: string;
}

export interface QueryTimetableParams {
  gradeId?: string;
  teacherId?: string;
  academicYearId?: string;
}

export function getTimetableEntries(params?: QueryTimetableParams) {
  return api.get<TimetableEntry[]>('/timetable', { params });
}

// Matches CreateTimetableEntryDto: startTime/endTime as 'HH:MM'.
export interface CreateTimetableEntryInput {
  academicYearId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room?: string;
}
export function createTimetableEntry(dto: CreateTimetableEntryInput) {
  return api.post<TimetableEntry>('/timetable', dto);
}

// Matches UpdateTimetableEntryDto — every field optional.
export type UpdateTimetableEntryInput = Partial<CreateTimetableEntryInput>;
export function updateTimetableEntry(id: string, dto: UpdateTimetableEntryInput) {
  return api.put<TimetableEntry>(`/timetable/${id}`, dto);
}

export function deleteTimetableEntry(id: string) {
  return api.delete<void>(`/timetable/${id}`);
}
