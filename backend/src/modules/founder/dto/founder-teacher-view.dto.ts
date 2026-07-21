import { User } from '../../users/entities/user.entity';

export interface FounderTeacherAssignmentView {
  gradeId: string;
  gradeTitle: string;
  subjectId: string | null;
  subjectTitle: string;
}

export interface FounderTeacherView {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  assignments: FounderTeacherAssignmentView[];
}

export function toFounderTeacherView(
  user: User,
  assignments: FounderTeacherAssignmentView[],
): FounderTeacherView {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
    assignments,
  };
}

// GET /founder/teachers — the cross-school variant, one row per teacher
// across every school the founder owns, tagged with which school it
// belongs to so the frontend can group by school (unlike GET
// /founder/schools/:schoolId/teachers, which is already scoped to a
// single school and needs no such tag).
export interface FounderTeacherWithSchoolView extends FounderTeacherView {
  schoolId: string;
  schoolName: string;
}

export function toFounderTeacherWithSchoolView(
  user: User,
  assignments: FounderTeacherAssignmentView[],
  schoolId: string,
  schoolName: string,
): FounderTeacherWithSchoolView {
  return {
    ...toFounderTeacherView(user, assignments),
    schoolId,
    schoolName,
  };
}
