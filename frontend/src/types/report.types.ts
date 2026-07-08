// Reporting domain types.
// Mirrors ReportsService's actual return shapes 1:1 — see Audit-Phase0
// report. In particular MonthlyIncome is ONE aggregate per (year, month)
// call, not a daily series; the income trend chart calls this once per
// month and assembles the series client-side.
//
// NOTE: the backend/DTO name for the debtor-list row is `DebtorStudent`,
// not `DebtorSummary`. Kept as-is here rather than renamed, per the
// "don't change behavior" rule for this phase — see migration report.

import type { TuitionPlan } from './tuition.types';

export interface StudentStatement {
  student: { id: string; fullName: string };
  tuitionPlans: TuitionPlan[];
  totals: {
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
  };
}

export interface OverdueSummary {
  overdueInstallmentCount: number;
  overdueStudentCount: number;
  totalOverdueAmount: number;
}

export interface MonthlyIncome {
  year: number;
  month: number;
  totalIncome: number;
  paymentCount: number;
}

export interface DebtorStudent {
  studentId: string;
  studentFullName: string;
  outstandingBalance: number;
}
