import { api } from '../lib/api';
import type { Student, StudentStatus } from '../types/student.types';

export interface QueryStudentsParams {
  search?: string;
  status?: StudentStatus;
  gradeId?: string;
  academicYearId?: string;
}

export function getStudents(params?: QueryStudentsParams) {
  return api.get<Student[]>('/students', { params });
}

export function getStudent(id: string) {
  return api.get<Student>(`/students/${id}`);
}

// Matches CreateStudentDto: academicYearId + gradeId required; guardian
// is either an existing guardianId OR a newGuardian object, never both.
export interface CreateStudentInput {
  academicYearId: string;
  gradeId: string;
  fullName: string;
  nationalId?: string;
  enrollmentDate?: string;
  guardianId?: string;
  newGuardian?: { fullName: string; phone: string };
}
export function createStudent(dto: CreateStudentInput) {
  return api.post<Student>('/students', dto);
}

// Matches UpdateStudentDto: only gradeId/status/fullName are accepted.
export interface UpdateStudentInput {
  gradeId?: string;
  status?: StudentStatus;
  fullName?: string;
}
export function updateStudent(id: string, dto: UpdateStudentInput) {
  return api.patch<Student>(`/students/${id}`, dto);
}

// DELETE /students/:id exists on the backend (soft-delete) but no page
// currently calls it — exposed here for future use, not wired to any
// button yet. See Phase 1 report.
export function archiveStudent(id: string) {
  return api.delete(`/students/${id}`);
}

// NOT a real backend "restore" — there is no /students/:id/restore route
// and no way to list/undo a soft-deleted row (findOne/findWithFilters
// never pass `withDeleted`). This is the same status-flip workaround
// ArchivedStudentsPage already used before this refactor: it just sets
// status back to 'active' via the normal update endpoint. Flagged in the
// Phase 1 report as a naming/semantic gap, not a new behavior.
export function restoreStudent(id: string) {
  return updateStudent(id, { status: 'active' });
}
