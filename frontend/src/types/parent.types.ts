// Parent portal domain types.
// Mirrors the backend Parent module view DTOs 1:1 (see
// backend/src/modules/parent/dto/*.ts). Do NOT add fields/concepts here
// that don't exist on those DTOs — same rule as every other types/*.ts
// file in this project.

import type { InstallmentStatus } from './tuition.types';
import type { PaymentMethod } from './payment.types';

// Mirrors backend ParentStudentView (parent-student-view.dto.ts).
export interface ParentStudentView {
  id: string;
  fullName: string;
  status: string;
  enrollmentDate: string | null;
  school: { id: string; name: string };
  grade: { id: string; title: string };
  academicYear: { id: string; title: string; isCurrent: boolean };
}

// Mirrors backend ParentTuitionViewDto (parent-tuition-view.dto.ts).
export interface ParentTuitionView {
  id: string;
  academicYearTitle: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  createdAt: string;
}

// Mirrors backend ParentInstallmentViewDto (parent-installments-view.dto.ts).
export interface ParentInstallmentView {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  dueDate: string;
}

// Mirrors backend ParentPaymentViewDto (parent-payments-view.dto.ts).
export interface ParentPaymentView {
  id: string;
  installmentId: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paidAt: string;
  receiptNumber: string | null;
}

// Mirrors backend RecipientAnnouncementView (announcements/dto/announcement-view.dto.ts),
// returned by GET /parent/announcements.
export interface ParentAnnouncementView {
  id: string;
  title: string;
  message: string;
  targetType: string;
  createdAt: string;
}
