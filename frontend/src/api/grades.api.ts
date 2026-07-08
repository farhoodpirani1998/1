import { api } from '../lib/api';
import type { Grade } from '../types/student.types';

export function getGrades() {
  return api.get<Grade[]>('/grades');
}

export interface CreateGradeInput {
  title: string;
}
export function createGrade(dto: CreateGradeInput) {
  return api.post<Grade>('/grades', dto);
}

// NOTE: no updateGrade() here — GradesController only exposes
// POST / and GET /, GET /:id. There is no PATCH route on the backend to
// rename/edit a grade. Flagged in the Phase 1 report rather than
// invented here.
