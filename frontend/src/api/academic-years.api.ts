import { api } from '../lib/api';
import type { AcademicYear } from '../types/student.types';

export function getAcademicYears() {
  return api.get<AcademicYear[]>('/academic-years');
}

export interface CreateAcademicYearInput {
  title: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}
export function createAcademicYear(dto: CreateAcademicYearInput) {
  return api.post<AcademicYear>('/academic-years', dto);
}

export interface UpdateAcademicYearInput {
  title?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}
export function updateAcademicYear(id: string, dto: UpdateAcademicYearInput) {
  return api.patch<AcademicYear>(`/academic-years/${id}`, dto);
}
