import { api } from '../lib/api';
import type { OverdueSummary, StudentStatement, MonthlyIncome, DebtorStudent } from '../types/report.types';

export function overdueSummary() {
  return api.get<OverdueSummary>('/reports/overdue-summary');
}

export function studentStatement(studentId: string) {
  return api.get<StudentStatement>(`/reports/student/${studentId}/statement`);
}

// Backend only aggregates by month (ONE object per year+month call) —
// there is no daily-series endpoint. See Audit-Phase0 report.
export function monthlyIncome(year: number, month: number) {
  return api.get<MonthlyIncome>('/reports/monthly-income', { params: { year, month } });
}

export function debtorStudents() {
  return api.get<DebtorStudent[]>('/reports/debtor-students');
}
