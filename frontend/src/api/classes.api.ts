import { api } from '../lib/api';
import type { SchoolClass } from '../types/student.types';

// Mirrors backend ClassesController (modules/classes) -- one row per
// section/class of a grade, scoped to (grade, academicYear). Added
// alongside Grade/AcademicYear as reference data StudentsPage and
// TeacherAssignmentsPage both need for their class pickers.

export interface QueryClassesParams {
  gradeId?: string;
  academicYearId?: string;
}

export function getClasses(params?: QueryClassesParams) {
  return api.get<SchoolClass[]>('/classes', { params });
}

export interface CreateClassInput {
  gradeId: string;
  academicYearId: string;
  title: string;
}
export function createClass(dto: CreateClassInput) {
  return api.post<SchoolClass>('/classes', dto);
}

export interface UpdateClassInput {
  title: string;
}
export function updateClass(id: string, dto: UpdateClassInput) {
  return api.patch<SchoolClass>(`/classes/${id}`, dto);
}

export function deleteClass(id: string) {
  return api.delete<void>(`/classes/${id}`);
}
