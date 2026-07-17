import { OverdueSummary, DebtorStudent } from '../../reports/reports.service';

export interface FounderTuitionOverview {
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdue: OverdueSummary;
  topDebtors: DebtorStudent[];
}
