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
  // Phase 4B: name search — matches against the installment's student
  // (see QueryInstallmentsDto on the backend). Previously InstallmentsPage
  // filtered its already-fetched array by this locally; now sent as a
  // real query param so it works against pages that aren't in memory.
  search?: string;
  page?: number;
  limit?: number;
}

// Same Phase-4A truncation as getStudents() above — InstallmentsPage
// paginates the returned array client-side and never sent a limit, so
// it silently never saw past the backend's default 50 installments.
// Request the backend's own ceiling (200) by default.
const FULL_LIST_LIMIT = 200;

export function getInstallments(params?: QueryInstallmentsParams) {
  return api.get<InstallmentWithStudent[]>('/installments', { params: { limit: FULL_LIST_LIMIT, ...params } });
}

// Phase 4B: real server-side pagination — same pattern/rationale as
// getStudentsPaginated() in students.api.ts. Always sends an explicit
// page/limit, which flips the backend to the wrapped `{ data, total,
// page, limit }` shape.
export interface PaginatedInstallmentsResult {
  data: InstallmentWithStudent[];
  total: number;
  page: number;
  limit: number;
}

export function getInstallmentsPaginated(
  page: number,
  limit: number,
  params?: QueryInstallmentsParams,
) {
  return api.get<PaginatedInstallmentsResult>('/installments', { params: { ...params, page, limit } });
}

// PATCH /tuition-plans/:id — matches UpdateTuitionPlanDto: only
// discountAmount/discountReason are editable (baseAmount is fixed once
// the plan is created; see TuitionPlansService.update on the backend).
export interface UpdateTuitionPlanInput {
  discountAmount?: number;
  discountReason?: string;
}
export function updateTuitionPlan(id: string, dto: UpdateTuitionPlanInput) {
  return api.patch<TuitionPlan>(`/tuition-plans/${id}`, dto);
}
