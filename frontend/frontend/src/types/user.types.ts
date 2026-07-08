// User-management domain types (UsersController), distinct from the
// auth session types in auth.types.ts (AuthUser is "who am I right
// now", ManagedUser is "a row in the users list").

import type { UserRole } from './auth.types';

export interface ManagedUser {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  schoolId: string | null;
}
