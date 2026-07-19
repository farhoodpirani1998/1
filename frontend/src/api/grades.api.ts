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

export interface UpdateGradeInput {
  title: string;
}
export function updateGrade(id: string, dto: UpdateGradeInput) {
  return api.patch<Grade>(`/grades/${id}`, dto);
}

export function deleteGrade(id: string) {
  return api.delete<void>(`/grades/${id}`);
}
