import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTuitionPlan,
  getTuitionPlan,
  generateInstallments,
  updateTuitionPlan,
  addInstallment,
  renegotiateInstallments,
  updateInstallment,
  overrideInstallmentStatus,
  writeOffInstallment,
  removeInstallment,
  type CreateTuitionPlanInput,
  type GenerateInstallmentsInput,
  type UpdateTuitionPlanInput,
  type AddInstallmentInput,
  type RenegotiateInstallmentsInput,
  type UpdateInstallmentInput,
  type OverrideInstallmentStatusInput,
  type WriteOffInstallmentInput,
  type RemoveInstallmentInput,
} from '../api/tuition.api';
import { queryKeys } from '../lib/queryKeys';

// GET /tuition-plans/:id isn't consumed by any page today (see
// tuition.api.ts comment — StudentDetailPage gets plans via the reports
// statement endpoint instead), but the hook is here for when it is.
export function useTuitionPlan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tuitionPlans.detail(id ?? ''),
    queryFn: () => getTuitionPlan(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateTuitionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTuitionPlanInput) => createTuitionPlan(dto).then((res) => res.data),
    onSuccess: (_data, dto) => {
      // A new plan changes the student's statement (tuitionPlans array,
      // totals) immediately, and — once it has installments — the
      // school's overall debt picture. No installments exist yet at
      // creation time, but invalidating reports broadly here is cheap
      // and avoids a subtly-stale debtor list if this ever changes.
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(dto.studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
    },
  });
}

export function useGenerateInstallments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, dto }: { planId: string; dto: GenerateInstallmentsInput }) =>
      generateInstallments(planId, dto).then((res) => res.data),
    onSuccess: (_data, { planId }) => {
      // Newly-generated installments are now real debt: they show up in
      // the installments list (InstallmentsPage), on the plan itself,
      // and immediately change debtor-students / overdue-summary
      // totals (a student who owed nothing now owes the plan's final
      // amount) even though no payment has happened yet.
      queryClient.invalidateQueries({ queryKey: queryKeys.installments.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tuitionPlans.detail(planId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
    },
  });
}

// ---------------------------------------------------------------------
// useUpdateTuitionPlan — PATCH /tuition-plans/:id (discountAmount /
// discountReason only; baseAmount is immutable after creation). Backend
// added this route after the note that used to live here claiming it
// didn't exist — see TuitionPlansController.update.
//
// Invalidates the same set useGenerateInstallments does
// (installments.all(), tuitionPlans.detail(planId), reports.all()) plus
// reports.studentStatement(studentId) directly, since editing a plan's
// discount changes finalAmount and therefore every total on the
// student's statement — a discount edit can also redistribute amounts
// across still-pending/overdue installments (see backend), which is why
// installments.all() is invalidated too.
// ---------------------------------------------------------------------
export function useUpdateTuitionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      dto,
    }: {
      planId: string;
      dto: UpdateTuitionPlanInput;
      studentId?: string; // context-only, not sent to the API — used for cache targeting below
    }) => updateTuitionPlan(planId, dto).then((res) => res.data),
    onSuccess: (_data, { planId, studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.installments.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tuitionPlans.detail(planId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(studentId) });
      }
    },
  });
}

// ---------------------------------------------------------------------
// useAddInstallment — POST /tuition-plans/:id/installments. Same
// invalidation set as useGenerateInstallments (a new installment is new
// debt against the plan), plus reports.studentStatement(studentId) when
// the caller has it on hand, same "context-only" pattern as
// useUpdateTuitionPlan's studentId field above.
// ---------------------------------------------------------------------
export function useAddInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      dto,
    }: {
      planId: string;
      dto: AddInstallmentInput;
      studentId?: string;
    }) => addInstallment(planId, dto).then((res) => res.data),
    onSuccess: (_data, { planId, studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.installments.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tuitionPlans.detail(planId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(studentId) });
      }
    },
  });
}

// ---------------------------------------------------------------------
// useRenegotiateInstallments — POST
// /tuition-plans/:id/installments/renegotiate. Rebuilds the plan's
// unpaid schedule, so the invalidation set is identical to
// useAddInstallment/useGenerateInstallments.
// ---------------------------------------------------------------------
export function useRenegotiateInstallments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      dto,
    }: {
      planId: string;
      dto: RenegotiateInstallmentsInput;
      studentId?: string;
    }) => renegotiateInstallments(planId, dto).then((res) => res.data),
    onSuccess: (_data, { planId, studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.installments.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tuitionPlans.detail(planId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(studentId) });
      }
    },
  });
}

// ---------------------------------------------------------------------
// useUpdateInstallment / useOverrideInstallmentStatus /
// useWriteOffInstallment / useRemoveInstallment — all four act on a
// single installment by id (no planId in the URL), so callers pass
// planId/studentId only for cache targeting, same context-only pattern
// used above. All change either the amount owed or an installment's
// status, which is exactly what installments.all() + reports.all()
// cover; tuitionPlans.detail(planId) and reports.studentStatement are
// added whenever the caller has that context on hand.
// ---------------------------------------------------------------------
function invalidateInstallmentMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  { planId, studentId }: { planId?: string; studentId?: string },
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.installments.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
  if (planId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tuitionPlans.detail(planId) });
  }
  if (studentId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(studentId) });
  }
}

export function useUpdateInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdateInstallmentInput;
      planId?: string;
      studentId?: string;
    }) => updateInstallment(id, dto).then((res) => res.data),
    onSuccess: (_data, ctx) => invalidateInstallmentMutation(queryClient, ctx),
  });
}

export function useOverrideInstallmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: OverrideInstallmentStatusInput;
      planId?: string;
      studentId?: string;
    }) => overrideInstallmentStatus(id, dto).then((res) => res.data),
    onSuccess: (_data, ctx) => invalidateInstallmentMutation(queryClient, ctx),
  });
}

export function useWriteOffInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: WriteOffInstallmentInput;
      planId?: string;
      studentId?: string;
    }) => writeOffInstallment(id, dto).then((res) => res.data),
    onSuccess: (_data, ctx) => invalidateInstallmentMutation(queryClient, ctx),
  });
}

export function useRemoveInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: RemoveInstallmentInput;
      planId?: string;
      studentId?: string;
    }) => removeInstallment(id, dto).then((res) => res.data),
    onSuccess: (_data, ctx) => invalidateInstallmentMutation(queryClient, ctx),
  });
}
