import { api } from '../lib/api';
import type {
  ParentStudentView,
  ParentTuitionView,
  ParentInstallmentView,
  ParentPaymentView,
  ParentAnnouncementView,
} from '../types/parent.types';

// GET /parent/students — @Roles('parent'). Returns only the students this
// parent account is linked to (never a school-wide list).
export function getMyStudents() {
  return api.get<ParentStudentView[]>('/parent/students');
}

// GET /parent/students/:id/tuition — @Roles('parent'). 404s if the
// student isn't linked to the calling parent (enforced server-side).
export function getStudentTuition(studentId: string) {
  return api.get<ParentTuitionView>(`/parent/students/${studentId}/tuition`);
}

// GET /parent/students/:id/installments — @Roles('parent').
export function getStudentInstallments(studentId: string) {
  return api.get<ParentInstallmentView[]>(`/parent/students/${studentId}/installments`);
}

// GET /parent/students/:id/payments — @Roles('parent'). Excludes voided
// payments (already filtered server-side).
export function getStudentPaymentHistory(studentId: string) {
  return api.get<ParentPaymentView[]>(`/parent/students/${studentId}/payments`);
}

// GET /parent/announcements — @Roles('parent'). Not scoped to one student;
// same announcements for every child this parent has linked, within their
// own school.
export function getMyAnnouncements() {
  return api.get<ParentAnnouncementView[]>('/parent/announcements');
}
