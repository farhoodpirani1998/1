import { User } from '../../users/entities/user.entity';

// Same "drop passwordHash (and here, tokenVersion — internal-only, no
// reason a founder's read-only view needs it)" shape as every other
// *-view.dto in this codebase (e.g. parent-student-view.dto). Founders
// never see a user's password hash or token version, only what a staff
// directory needs.
export interface FounderStaffMemberView {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export function toFounderStaffMemberView(user: User): FounderStaffMemberView {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
