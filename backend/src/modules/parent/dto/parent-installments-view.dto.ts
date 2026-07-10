import { Installment } from '../../tuition/entities/installment.entity';

/**
 * Parent-visible installment summary. Shows status, amount, paid amount,
 * and due date for payment tracking.
 */
export class ParentInstallmentViewDto {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string;
}

export function toParentInstallmentView(installment: Installment): ParentInstallmentViewDto {
  const paidAmount = Number(installment.paidAmount);
  const amount = Number(installment.amount);
  const remainingAmount = Math.max(0, amount - paidAmount);

  return {
    id: installment.id,
    installmentNumber: installment.installmentNumber,
    amount,
    paidAmount,
    remainingAmount,
    status: installment.status,
    dueDate: installment.dueDate,
  };
}
