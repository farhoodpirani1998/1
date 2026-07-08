import { api } from '../lib/api';
import type { School } from '../types/school.types';

export function getSchools() {
  return api.get<School[]>('/schools');
}

export interface CreateSchoolInput {
  name: string;
  address?: string;
  phone?: string;
}
export function createSchool(dto: CreateSchoolInput) {
  return api.post<School>('/schools', dto);
}

export interface UpdateSchoolInput {
  name?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}
export function updateSchool(id: string, dto: UpdateSchoolInput) {
  return api.patch<School>(`/schools/${id}`, dto);
}

// DELETE /schools/:id = deactivate (soft), matches SchoolsController.
// Kept separate from updateSchool since that's the real backend verb
// SchoolsPage already relies on for turning a school off.
export function deactivateSchool(id: string) {
  return api.delete(`/schools/${id}`);
}
