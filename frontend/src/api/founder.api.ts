import { api } from '../lib/api';
import type {
  FounderSchool,
  FounderOverview,
  FounderSchoolDashboard,
  FounderStudent,
  QueryFounderStudentsParams,
  FounderTeacher,
  FounderStaffMember,
  FounderTuitionSummary,
  FounderLink,
} from '../types/founder.types';

// GET /founder/schools — @Roles('founder'). Schools owned by the caller.
// This is the source of truth for which schoolIds a founder may view —
// every other /founder/schools/:schoolId/* call below 404s (not 403) for
// any id outside this list (see founder-frontend-prompt.md §4).
export function getFounderSchools() {
  return api.get<FounderSchool[]>('/founder/schools');
}

// GET /founder/overview — @Roles('founder'). Aggregated totals across
// every owned school, plus a per-school breakdown.
export function getFounderOverview() {
  return api.get<FounderOverview>('/founder/overview');
}

export interface FounderSchoolDashboardParams {
  recentLimit?: number;
  trendDays?: number;
  monthsBack?: number;
}

// GET /founder/schools/:schoolId/dashboard — @Roles('founder').
export function getFounderSchoolDashboard(schoolId: string, params?: FounderSchoolDashboardParams) {
  return api.get<FounderSchoolDashboard>(`/founder/schools/${schoolId}/dashboard`, { params });
}

// GET /founder/schools/:schoolId/students — @Roles('founder'). Only this
// list endpoint takes page/limit; the others below return their full
// result every time (see founder-frontend-prompt.md §4).
export function getFounderSchoolStudents(schoolId: string, params?: QueryFounderStudentsParams) {
  return api.get<FounderStudent[]>(`/founder/schools/${schoolId}/students`, { params });
}

// GET /founder/schools/:schoolId/teachers — @Roles('founder').
export function getFounderSchoolTeachers(schoolId: string) {
  return api.get<FounderTeacher[]>(`/founder/schools/${schoolId}/teachers`);
}

// GET /founder/schools/:schoolId/staff — @Roles('founder'). Non-teacher
// staff (school_admin / accountant / staff roles).
export function getFounderSchoolStaff(schoolId: string) {
  return api.get<FounderStaffMember[]>(`/founder/schools/${schoolId}/staff`);
}

// GET /founder/schools/:schoolId/tuition — @Roles('founder').
export function getFounderSchoolTuition(schoolId: string) {
  return api.get<FounderTuitionSummary>(`/founder/schools/${schoolId}/tuition`);
}

// --- super_admin-only ownership management (§3) ---
// Distinct from everything above: these two calls are made by a
// super_admin managing which schools a founder account owns, not by the
// founder themself. Used from the Schools admin page's link manager.

export function linkFounderToSchool(founderId: string, schoolId: string) {
  return api.post<FounderLink>('/founder/link', { founderId, schoolId });
}

export function unlinkFounderFromSchool(linkId: string) {
  return api.delete(`/founder/link/${linkId}`);
}
