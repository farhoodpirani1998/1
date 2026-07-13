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

export interface CreateSubjectInput {
  title: string;
}
export function createSubject(dto: CreateSubjectInput) {
  return api.post<Subject>('/subjects', dto);
}
