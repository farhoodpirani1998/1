import { api } from '../lib/api';
import type { Student, StudentStatus } from '../types/student.types';

export interface QueryStudentsParams {
  search?: string;
  status?: StudentStatus;
  gradeId?: string;
  academicYearId?: string;
  page?: number;
  limit?: number;
}

// Backend default is 50 rows (see DEFAULT_PAGE_LIMIT in
// backend/src/common/utils/pagination.ts) when no limit is sent, and
// none of this app's callers ever sent one — they all treat the response
// as "the full roster" and paginate/filter it client-side (StudentsPage,
// plus every dropdown that reads useStudents()). That silently hid every
// student past the 50th. MAX_PAGE_LIMIT (200) is the backend's own
// ceiling for a single request; request it by default so a caller that
// does pass an explicit limit/page (for real server-side pagination)
// still overrides this.
const FULL_ROSTER_LIMIT = 200;

export function getStudents(params?: QueryStudentsParams) {
  return api.get<Student[]>('/students', { params: { limit: FULL_ROSTER_LIMIT, ...params } });
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

// Sprint 1 (Bulk Import): POST /students/bulk-import — same row shape as
// CreateStudentInput above, sent as an array. Response is per-row
// (never all-or-nothing); see BulkImportRowResult below.
export interface BulkImportRowResult {
  index: number;
  success: boolean;
  studentId?: string;
  fullName?: string;
  error?: string;
}
export interface BulkImportStudentsResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  results: BulkImportRowResult[];
}
export function bulkImportStudents(rows: CreateStudentInput[]) {
  return api.post<BulkImportStudentsResult>('/students/bulk-import', { students: rows });
}

// Matches CreateStudentParentDto: fullName/phone/password. See
// POST /students/:id/parent — creates (or, for a sibling sharing a
// parent, reuses) a parent-portal login and links it to this student.
export interface AddStudentParentInput {
  fullName: string;
  phone: string;
  password: string;
}

// Matches StudentParentView on the backend.
export interface StudentParentLink {
  linkId: string;
  id: string;
  fullName: string;
  phone: string;
  isActive: boolean;
}

export function addStudentParent(studentId: string, dto: AddStudentParentInput) {
  return api.post<StudentParentLink>(`/students/${studentId}/parent`, dto);
}

export function getStudentParents(studentId: string) {
  return api.get<StudentParentLink[]>(`/students/${studentId}/parents`);
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
