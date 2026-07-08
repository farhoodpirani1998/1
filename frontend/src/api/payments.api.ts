import { api } from '../lib/api';
import type { Payment, PaymentMethod, PaymentWithContext } from '../types/payment.types';

export interface CreatePaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  paidAt: string;
  note?: string;
  idempotencyKey?: string;
}
export function createPayment(installmentId: string, dto: CreatePaymentInput) {
  return api.post<Payment>(`/installments/${installmentId}/payments`, dto);
}

// DELETE /payments/:id requires `reason` (min 5 chars) in the body —
// VoidPaymentDto on the backend.
export function voidPayment(paymentId: string, reason: string) {
  return api.delete(`/payments/${paymentId}`, { data: { reason } });
}

// GET /payments?studentId=... exists on the backend, not currently
// called by any page. Exposed here for future use.
export function getPayments(studentId?: string) {
  return api.get<PaymentWithContext[]>('/payments', { params: studentId ? { studentId } : {} });
}
