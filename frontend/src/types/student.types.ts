// Student domain types.
// Mirrors the actual backend models 1:1 (see modules/students/* entities
// and dto). Do NOT add fields/concepts here that don't exist on the
// backend (no Class, no Student.birthDate/address) — see Audit-Phase0
// report for why those were removed.

export type StudentStatus = 'active' | 'withdrawn' | 'graduated';

export interface Guardian {
  id: string;
  fullName: string;
  phone: string;
  nationalId: string | null;
}

export interface Grade {
  id: string;
  title: string;
}

export interface AcademicYear {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

export interface Student {
  id: string;
  fullName: string;
  nationalId: string | null;
  status: StudentStatus;
  enrollmentDate: string | null;
  gradeId: string;
  academicYearId: string;
  guardianId: string | null;
  deletedAt?: string | null;
  guardian?: Guardian | null;
  grade?: Grade | null;
  academicYear?: AcademicYear | null;
}
