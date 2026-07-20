// Student domain types.
// Mirrors the actual backend models 1:1 (see modules/students/* entities
// and dto).

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

// One section/class of a Grade, for one AcademicYear -- e.g. two
// SchoolClass rows "الف"/"ب" under the same Grade for the same year. See
// backend/src/modules/classes/entities/class.entity.ts. Named
// SchoolClass rather than Class here since `class` is a reserved word
// for a TS *identifier* (it's still fine as an object property name --
// see Student.class below, matching the backend's own relation name).
export interface SchoolClass {
  id: string;
  gradeId: string;
  academicYearId: string;
  title: string;
}

export interface Student {
  id: string;
  fullName: string;
  nationalId: string | null;
  status: StudentStatus;
  enrollmentDate: string | null;
  gradeId: string;
  academicYearId: string;
  // Nullable: which section of the grade this student is placed in.
  // Not every school splits a grade into sections -- see
  // AddClassIdToStudents migration.
  classId: string | null;
  guardianId: string | null;
  deletedAt?: string | null;
  guardian?: Guardian | null;
  grade?: Grade | null;
  class?: SchoolClass | null;
  academicYear?: AcademicYear | null;
}
