import { api } from '../lib/api';
import type { TuitionPlan, Installment, InstallmentStatus, InstallmentWithStudent } from '../types/tuition.types';

export interface CreateTuitionPlanInput {
  studentId: string;
  academicYearId: string;
  baseAmount: number;
  discountAmount?: number;
  discountReason?: string;
}
export function createTuitionPlan(dto: CreateTuitionPlanInput) {
  return api.post<TuitionPlan>('/tuition-plans', dto);
}

// GET /tuition-plans/:id — exists on the backend, not currently called
// by any page (StudentDetailPage gets its plans via the reports
// statement endpoint instead). Exposed here for future use.
export function getTuitionPlan(id: string) {
  return api.get<TuitionPlan>(`/tuition-plans/${id}`);
}

export interface GenerateInstallmentsInput {
  count: number;
  startDate: string;
  intervalDays: number;
}
export function generateInstallments(planId: string, dto: GenerateInstallmentsInput) {
  return api.post<Installment[]>(`/tuition-plans/${planId}/installments/generate`, dto);
}

export interface QueryInstallmentsParams {
  status?: InstallmentStatus;
}
export function getInstallments(params?: QueryInstallmentsParams) {
  return api.get<InstallmentWithStudent[]>('/installments', { params });
}
