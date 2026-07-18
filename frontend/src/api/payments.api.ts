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

// GET /payments/:id/receipt — real backend-sourced receipt data (school
// name/address/phone, receipt number, who received the payment), not
// reconstructed client-side from whatever the caller happened to have in
// memory. See ReceiptView below for the exact shape PaymentsService.getReceipt
// returns.
export interface ReceiptView {
  receiptNumber: string | null;
  amount: number;
  paymentMethod: string | null;
  paidAt: string;
  school: { name: string; address: string | null; phone: string | null };
  student: { id: string; fullName: string };
  receivedBy: { id: string; fullName: string } | null;
}
export function getReceipt(paymentId: string) {
  return api.get<ReceiptView>(`/payments/${paymentId}/receipt`);
}
