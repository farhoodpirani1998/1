import { api } from '../lib/api';
import type { ManagedUser } from '../types/user.types';
import { register, RegisterUserInput } from './auth.api';

export function getUsers() {
  return api.get<ManagedUser[]>('/users');
}

// NOTE: there is no POST /users route on the backend — UsersController
// only exposes GET / and PATCH /:id. The only way to create a user is
// POST /auth/register (super_admin only). This just forwards to it so
// callers can keep using a `usersApi.createUser` name; see Phase 1
// report.
export function createUser(dto: RegisterUserInput) {
  return register(dto);
}

export interface UpdateUserInput {
  isActive?: boolean;
  fullName?: string;
  phone?: string;
}

// UsersController's PATCH /:id now accepts any combination of
// isActive/fullName/phone (see backend UpdateUserDto) — role/schoolId are
// never sent from here since the backend doesn't accept them on this
// route (changing either requires deleting and recreating the user).
export function updateUser(id: string, dto: UpdateUserInput) {
  return api.patch<ManagedUser>(`/users/${id}`, dto);
}

export function resetUserPassword(id: string, newPassword: string) {
  return api.patch<ManagedUser>(`/users/${id}/reset-password`, { newPassword });
}
