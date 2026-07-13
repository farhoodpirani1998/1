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
//
// Sprint 2B: teacherName/gradeTitle/subjectTitle added, same optional
// "?" shape as TeacherProfileView.assignments above -- present whenever
// the relation was loaded (TeacherService now always loads
// teacher/grade/subject via ASSIGNMENT_RELATIONS), omitted rather than
// null if a relation is ever missing. Additive only: teacherId/gradeId/
// subjectId/createdAt are unchanged, so existing consumers of this shape
// keep working untouched.
export interface TeacherAssignmentView {
  id: string;
  teacherId: string;
  teacherName?: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
  createdAt: Date;
}

export function toTeacherAssignmentView(assignment: TeacherAssignment): TeacherAssignmentView {
  return {
    id: assignment.id,
    teacherId: assignment.teacherId,
    teacherName: assignment.teacher?.fullName,
    gradeId: assignment.gradeId,
    gradeTitle: assignment.grade?.title,
    subjectId: assignment.subjectId,
    subjectTitle: assignment.subject?.title,
    createdAt: assignment.createdAt,
  };
}

// GET /teacher/list (school_admin-only): the roster of teacher-role
// users in the caller's own school, used to populate the teacher picker
// on TeacherAssignmentsPage. Same "reshape, never leak the ORM entity
// as-is" reasoning as toTeacherProfileView -- passwordHash never leaves
// this DTO.
export interface TeacherListItemView {
  id: string;
  fullName: string;
  phone: string;
  isActive: boolean;
}

export function toTeacherListItemView(
  user: Pick<User, 'id' | 'fullName' | 'phone' | 'isActive'>,
): TeacherListItemView {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    isActive: user.isActive,
  };
}
