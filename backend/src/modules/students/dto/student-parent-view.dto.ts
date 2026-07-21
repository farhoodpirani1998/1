import { ParentStudent } from '../../parent/entities/parent-student.entity';
import { User } from '../../users/entities/user.entity';

// Response shape for POST /students/:id/parent and GET /students/:id/parents.
// `linkId` is the parent_students row id (needed by the frontend to call
// the existing DELETE /parent/link/:id), distinct from `id`, which is the
// parent's own user id.
export interface StudentParentView {
  linkId: string;
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
}

export function toStudentParentView(link: ParentStudent): StudentParentView {
  return {
    linkId: link.id,
    id: link.parent.id,
    fullName: link.parent.fullName,
    phone: link.parent.phone,
    isActive: link.parent.isActive,
  };
}

// Used right after create-or-link, where we have the User and the fresh
// link row separately rather than a loaded `link.parent` relation.
export function toStudentParentViewFromUser(user: User, linkId: string): StudentParentView {
  return {
    linkId,
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    isActive: user.isActive,
  };
}
