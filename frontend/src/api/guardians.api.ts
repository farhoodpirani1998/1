import { api } from '../lib/api';
import type { Guardian as BaseGuardian } from '../types/student.types';

// Sprint 2 (Educational Operations): guardian file management. Matches
// GuardiansController on the backend (backend/src/modules/students/
// guardians.controller.ts) — GET /guardians, GET /guardians/:id,
// PATCH /guardians/:id.

export interface GuardianStudentSummary {
  id: string;
  fullName: string;
  gradeId: string;
  gradeTitle?: string;
  status: string;
}

// Extends the existing Guardian shape (student.types.ts) with the
// linked-students summary, only populated by getGuardian(id) — the
// list endpoint omits it.
export interface Guardian extends BaseGuardian {
  students?: GuardianStudentSummary[];
}

export interface QueryGuardiansParams {
  search?: string;
  page?: number;
  limit?: number;
}

export function getGuardians(params?: QueryGuardiansParams) {
  return api.get<Guardian[]>('/guardians', { params });
}

export function getGuardian(id: string) {
  return api.get<Guardian>(`/guardians/${id}`);
}

// Matches UpdateGuardianDto: fullName/phone/nationalId, all optional.
export interface UpdateGuardianInput {
  fullName?: string;
  phone?: string;
  nationalId?: string;
}
export function updateGuardian(id: string, dto: UpdateGuardianInput) {
  return api.patch<Guardian>(`/guardians/${id}`, dto);
}
