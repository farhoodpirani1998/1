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

// UsersController's PATCH /:id only ever accepts { isActive } — it is
// not a general-purpose update endpoint.
export function updateUser(id: string, isActive: boolean) {
  return api.patch<ManagedUser>(`/users/${id}`, { isActive });
}
