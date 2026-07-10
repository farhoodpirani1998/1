import { User } from '../../users/entities/user.entity';
import { TeacherAssignment } from '../entities/teacher-assignment.entity';

// GET /teacher/profile: the teacher's own account, minus passwordHash
// (never leaves UsersService/AuthService either), plus a compact summary
// of what they're assigned to teach -- same "reshape, don't leak the ORM
// entity as-is" reasoning as toAttendanceView / toParentStudentView.
export interface TeacherProfileView {
  id: string;
  fullName: string;
  phone: string;
  schoolId: string;
  isActive: boolean;
  assignments: Array<{
    id: string;
    gradeId: string;
    gradeTitle?: string;
    subjectId: string;
    subjectTitle?: string;
  }>;
}

export function toTeacherProfileView(
  user: Pick<User, 'id' | 'fullName' | 'phone' | 'schoolId' | 'isActive'>,
  assignments: TeacherAssignment[],
): TeacherProfileView {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    schoolId: user.schoolId as string,
    isActive: user.isActive,
    assignments: assignments.map((a) => ({
      id: a.id,
      gradeId: a.gradeId,
      gradeTitle: a.grade?.title,
      subjectId: a.subjectId,
      subjectTitle: a.subject?.title,
    })),
  };
}

// GET /teacher/assignments (school_admin-side listing): the same shape
// TeacherService.assign() returns from a POST, reused for GET so the
// admin-facing responses are consistent.
export interface TeacherAssignmentView {
  id: string;
  teacherId: string;
  gradeId: string;
  subjectId: string;
  createdAt: Date;
}

export function toTeacherAssignmentView(assignment: TeacherAssignment): TeacherAssignmentView {
  return {
    id: assignment.id,
    teacherId: assignment.teacherId,
    gradeId: assignment.gradeId,
    subjectId: assignment.subjectId,
    createdAt: assignment.createdAt,
  };
}
