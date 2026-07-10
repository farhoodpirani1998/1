import { Student } from '../../students/entities/student.entity';

// Deliberately narrower than the internal Student shape returned by
// StudentsService: no guardian contact info, no nationalId of other
// students, nothing from other modules. A parent only ever needs to
// recognize "which of my children is this" plus school/grade/year context
// (task 4's exact field list) — anything else is scope creep for a
// foundation-phase read endpoint.
export interface ParentStudentView {
  id: string;
  fullName: string;
  status: string;
  enrollmentDate: string | null;
  school: { id: string; name: string };
  grade: { id: string; title: string };
  academicYear: { id: string; title: string; isCurrent: boolean };
}

export function toParentStudentView(student: Student): ParentStudentView {
  return {
    id: student.id,
    fullName: student.fullName,
    status: student.status,
    enrollmentDate: student.enrollmentDate,
    school: { id: student.school.id, name: student.school.name },
    grade: { id: student.grade.id, title: student.grade.title },
    academicYear: {
      id: student.academicYear.id,
      title: student.academicYear.title,
      isCurrent: student.academicYear.isCurrent,
    },
  };
}
