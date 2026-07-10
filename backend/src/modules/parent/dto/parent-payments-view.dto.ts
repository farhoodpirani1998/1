import { Payment } from '../../tuition/entities/payment.entity';

/**
 * Parent-visible payment history entry. Shows payment amount, method, date,
 * and status for tracking purposes. Excludes voided payments.
 */
export class ParentPaymentViewDto {
  id: string;
  installmentId: string;
  amount: number;
  paymentMethod: string | null;
  paidAt: Date;
  receiptNumber: string | null;
}

export function toParentPaymentView(payment: Payment): ParentPaymentViewDto {
  return {
    id: payment.id,
    installmentId: payment.installmentId,
    amount: Number(payment.amount),
    paymentMethod: payment.paymentMethod ?? null,
    paidAt: payment.paidAt,
    receiptNumber: payment.receiptNumber,
  };
}
