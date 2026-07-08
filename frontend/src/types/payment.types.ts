// Payment domain types.
// Mirrors the actual backend models 1:1 (see modules/payments/* entities
// and dto). Do NOT add fields/concepts here that don't exist on the
// backend — see Audit-Phase0 report.
//
// NOTE: there is no PaymentStatus or Receipt type on the backend today.
// Payments don't carry a status field, and "receipts" are just
// PrintReceiptPage's client-side view of a Payment (see
// pages/PrintReceiptPage.tsx#ReceiptData, which is a page-local view
// model, not a backend entity). Not invented here — flagged instead of
// silently added, per the Phase 1.5 instructions.

export type PaymentMethod = 'cash' | 'card_to_card' | 'cheque';

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paidAt: string;
  referenceNumber?: string | null;
  receiptNumber?: string | null;
  note?: string | null;
}

export interface PaymentWithContext extends Payment {
  installment: {
    id: string;
    installmentNumber: number;
    tuitionPlan?: { student?: { id: string; fullName: string } };
  };
}
