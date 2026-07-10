import { TuitionPlan } from '../../tuition/entities/tuition-plan.entity';
import { Installment } from '../../tuition/entities/installment.entity';

/**
 * Parent-visible tuition plan summary. Includes only the financial data
 * relevant to payment tracking; excludes audit/admin fields like discount reason.
 */
export class ParentTuitionViewDto {
  id: string;
  academicYearTitle: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  createdAt: Date;
}

export function toParentTuitionView(plan: TuitionPlan & { academicYear?: { title: string } }): ParentTuitionViewDto {
  return {
    id: plan.id,
    academicYearTitle: plan.academicYear?.title ?? '',
    baseAmount: Number(plan.baseAmount),
    discountAmount: Number(plan.discountAmount),
    finalAmount: Number(plan.finalAmount),
    createdAt: plan.createdAt,
  };
}
