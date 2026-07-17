import { User } from '../../users/entities/user.entity';

export interface FounderTeacherAssignmentView {
  gradeId: string;
  gradeTitle: string;
  subjectId: string;
  subjectTitle: string;
}

export interface FounderTeacherView {
  id: string;
  fullName: string;
  phone: string;
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
