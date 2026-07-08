import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTuitionPlan,
  getTuitionPlan,
  generateInstallments,
  type CreateTuitionPlanInput,
  type GenerateInstallmentsInput,
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
// NOT IMPLEMENTED: useUpdateTuitionPlan
//
// The Phase 2 brief asked for invalidation rules for updateTuitionPlan,
// but there is no such function in tuition.api.ts and no PATCH
// /tuition-plans/:id route referenced anywhere in the Phase 0/1
// comments — TuitionPlansController only exposes POST / and the
// installments-generate sub-route. Inventing the API call would violate
// the "don't change backend contract" rule from Phase 1, so this hook
// is intentionally not created.
//
// If/when that endpoint exists, it should invalidate exactly what
// useGenerateInstallments does above (installments.all(),
// tuitionPlans.detail(planId), reports.all()) plus
// reports.studentStatement(studentId) directly, since editing a plan's
// baseAmount/discount changes finalAmount and therefore every total on
// the student's statement.
// ---------------------------------------------------------------------
