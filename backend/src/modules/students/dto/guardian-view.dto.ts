import { Guardian } from '../entities/guardian.entity';
import { Student } from '../entities/student.entity';

// school_admin-facing guardian shape, same "reshape, don't leak the ORM
// entity as-is" reasoning as StudentParentView / TimetableEntryView.
// `students` is only populated on the single-record read
// (GET /guardians/:id, via GuardiansService.findOneForSchool) -- the list
// read (GET /guardians) omits it to keep the roster query a single
// cheap SELECT rather than an N+1 per guardian.
export interface GuardianView {
  id: string;
  fullName: string;
  phone: string;
  nationalId: string | null;
  students?: GuardianStudentSummary[];
}

export interface GuardianStudentSummary {
  id: string;
  fullName: string;
  gradeId: string;
  gradeTitle?: string;
  status: string;
}

export function toGuardianView(guardian: Guardian): GuardianView {
  return {
    id: guardian.id,
    fullName: guardian.fullName,
    phone: guardian.phone,
    nationalId: guardian.nationalId,
  };
}

export function toGuardianViewWithStudents(
  guardian: Guardian,
  students: Student[],
): GuardianView {
  return {
    ...toGuardianView(guardian),
    students: students.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      gradeId: student.gradeId,
      gradeTitle: student.grade?.title,
      status: student.status,
    })),
  };
}
