// Tuition / installment domain types.
// Mirrors the actual backend models 1:1 (see modules/tuition-plans/* and
// modules/installments/* entities and dto). Do NOT add fields/concepts
// here that don't exist on the backend (no DiscountType catalog) — see
// Audit-Phase0 report for why those were removed.

import type { Payment } from './payment.types';

export type InstallmentStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'partial'
  | 'cancelled'
  | 'deferred'
  | 'disputed';

export interface Installment {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: InstallmentStatus;
  payments: Payment[];
}

// GET /installments (unlike the installments embedded in a TuitionPlan)
// also joins in the owning student — see tuition.api.ts#getInstallments.
// This was previously an unsafe `res.data as unknown as InstallmentRow[]`
// cast in InstallmentsPage; flagged in the Phase 2 report and fixed here
// as a type-only change (no behavior difference).
export interface InstallmentWithStudent extends Installment {
  tuitionPlan: { student: { id: string; fullName: string } };
}

export interface TuitionPlan {
  id: string;
  academicYearId: string;
  baseAmount: number;
  discountAmount: number;
  discountReason?: string | null;
  finalAmount: number;
  installments: Installment[];
}
