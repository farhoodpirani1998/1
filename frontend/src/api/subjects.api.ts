// Sprint 2B: school-wide Subject reference list (SubjectsController on
// the backend, GET/POST /subjects). Added for TeacherAssignmentsPage's
// subject picker — same shape and role gate (school_admin can read and
// write, accountant/staff read-only) as grades.api.ts's Grade.
//
// Named listSubjects rather than getSubjects: teacher.api.ts already
// exports getSubjects() for GET /teacher/subjects (the signed-in
// teacher's own deduped subject list) — both are re-exported from the
// same api/index.ts barrel, so this avoids the name collision.

import { api } from '../lib/api';
import type { Subject } from '../types/teacher.types';

export function listSubjects() {
  return api.get<Subject[]>('/subjects');
}

// GET /subjects/:id — school_admin/accountant/staff. Used by the subject
// detail page linked from Global Search results.
export function getSubject(id: string) {
  return api.get<Subject>(`/subjects/${id}`);
}

export interface CreateSubjectInput {
  title: string;
}
export function createSubject(dto: CreateSubjectInput) {
  return api.post<Subject>('/subjects', dto);
}

export interface UpdateSubjectInput {
  title: string;
}
export function updateSubject(id: string, dto: UpdateSubjectInput) {
  return api.patch<Subject>(`/subjects/${id}`, dto);
}

export function deleteSubject(id: string) {
  return api.delete<void>(`/subjects/${id}`);
}
