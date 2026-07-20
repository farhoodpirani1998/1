import { Student, StudentStatus } from '../../students/entities/student.entity';

/**
 * ADR-001 Task 4A-1: the authenticated student's own basic profile —
 * deliberately not the rich admin-facing aggregate in
 * modules/students/profile/student-profile-view.dto.ts (tuition,
 * payments, attendance, etc.). This is just the Student record's own
 * fields, reshaped the same "no new calculation, just reshape what
 * already exists" way StudentProfileView does for its own module.
 * Richer sections (attendance, homework, announcements...) can be added
 * to this view in later tasks the same way they were added there.
 */
export interface StudentSelfProfileView {
  id: string;
  fullName: string;
  nationalId: string | null;
  status: StudentStatus;
  gradeId: string;
  academicYearId: string;
  classId: string | null;
  schoolId: string;
  enrollmentDate: string | null;
}

export function toStudentSelfProfileView(student: Student): StudentSelfProfileView {
  return {
    id: student.id,
    fullName: student.fullName,
    nationalId: student.nationalId,
    status: student.status,
    gradeId: student.gradeId,
    academicYearId: student.academicYearId,
    classId: student.classId,
    schoolId: student.schoolId,
    enrollmentDate: student.enrollmentDate,
  };
}
