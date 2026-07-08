// Payment mutations — the two highest-blast-radius operations in the
// whole app. A single payment (or voiding one) touches:
//   - the installment it belongs to (amount paid, status: pending/
//     partial -> paid, or paid -> partial/pending on void)
//   - every installments list currently in cache (status filters)
//   - the tuition plan it belongs to (if ever cached via useTuitionPlan)
//   - the student's statement (totals.totalPaid/totalRemaining)
//   - overdue-summary, monthly-income (this month), and debtor-students
//     school-wide, since one student's balance moving changes all three
//     aggregates
//
// Rather than track down every one of those keys by hand (and risk
// missing one — e.g. forgetting monthly-income after a void), both
// mutations invalidate installments.all(), tuitionPlans.all(), and
// reports.all() as whole domains. This means a few extra refetches on
// a financial-write action, which is the right trade for a system
// tracking real money — a stale debtor list or stale overdue count is
// worse than one extra request.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPayment, voidPayment, getPayments, type CreatePaymentInput } from '../api/payments.api';
import { queryKeys } from '../lib/queryKeys';

export function usePayments(studentId?: string) {
  return useQuery({
    queryKey: queryKeys.payments.list(studentId),
    queryFn: () => getPayments(studentId).then((res) => res.data),
  });
}

function invalidatePaymentEffects(queryClient: ReturnType<typeof useQueryClient>, studentId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.installments.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.tuitionPlans.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
  if (studentId) {
    // Redundant with reports.all() above (studentStatement's key is
    // prefixed by reports.all()) but kept explicit for readability/
    // documentation of intent.
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(studentId) });
  }
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      installmentId,
      dto,
    }: {
      installmentId: string;
      dto: CreatePaymentInput;
      studentId?: string; // context-only, not sent to the API — used for cache targeting below
    }) => createPayment(installmentId, dto).then((res) => res.data),
    onSuccess: (_data, { studentId }) => invalidatePaymentEffects(queryClient, studentId),
  });
}

export function useVoidPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string; studentId?: string }) =>
      voidPayment(paymentId, reason),
    onSuccess: (_data, { studentId }) => invalidatePaymentEffects(queryClient, studentId),
  });
}
