export interface FounderSchoolBreakdown {
  schoolId: string;
  schoolName: string;
  isActive: boolean;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdueAmount: number;
}

export interface FounderOverviewTotals {
  schoolCount: number;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdueAmount: number;
}

export interface FounderOverviewView {
  totals: FounderOverviewTotals;
  schools: FounderSchoolBreakdown[];
  generatedAt: Date;
}
