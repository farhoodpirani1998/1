import { useQueries, useQuery } from '@tanstack/react-query';
import { overdueSummary, monthlyIncome, debtorStudents, studentStatement } from '../api/reports.api';
import { queryKeys } from '../lib/queryKeys';

export function useOverdueSummary() {
  return useQuery({
    queryKey: queryKeys.reports.overdueSummary(),
    queryFn: () => overdueSummary().then((res) => res.data),
  });
}

export function useMonthlyIncome(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.reports.monthlyIncome(year, month),
    queryFn: () => monthlyIncome(year, month).then((res) => res.data),
  });
}

export function useDebtorStudents() {
  return useQuery({
    queryKey: queryKeys.reports.debtorStudents(),
    queryFn: () => debtorStudents().then((res) => res.data),
  });
}

// Backend only exposes GET /reports/monthly-income?year&month, returning
// ONE aggregate per call — there is no daily/monthly-series endpoint.
// ReportsPage builds a trend by calling it once per month (variable
// count, hence useQueries instead of N separate useQuery calls, which
// would break the rules of hooks if the month count ever changed).
export function useMonthlyIncomeTrend(months: { year: number; month: number }[]) {
  return useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: queryKeys.reports.monthlyIncome(year, month),
      queryFn: () => monthlyIncome(year, month).then((res) => res.data),
    })),
  });
}

export function useStudentStatement(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reports.studentStatement(studentId ?? ''),
    queryFn: () => studentStatement(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}
