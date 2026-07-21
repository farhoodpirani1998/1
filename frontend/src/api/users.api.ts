import { api } from '../lib/api';
import type { ManagedUser } from '../types/user.types';
import type { MyProfile } from '../types/myProfile.types';
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

// Sprint A3 — My Profile. Self-service only — GET/PATCH /users/me
// (UsersMeController), returning the fuller MyProfile shape (phone,
// username, schoolName, createdAt) that AuthUser's lightweight session
// model deliberately doesn't carry.
export function getMyProfile() {
  return api.get<MyProfile>('/users/me');
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
}
export function updateMyProfile(dto: UpdateProfileInput) {
  return api.patch<MyProfile>('/users/me', dto);
}

// Sprint P1 — Universal Avatar System. Self-service only — these hit
// POST/DELETE /users/me/avatar (UsersMeController), never
// /users/:id/avatar, so there is no cross-user avatar-editing path from
// the frontend either. Both return the caller's own full "safe user"
// row (same shape as every other endpoint here), with avatarUrl
// updated/cleared — see useUploadAvatar/useDeleteAvatar for how that's
// then pushed into AuthContext.
//
// multipart/form-data, field name "avatar" — matches
// FileInterceptor('avatar', ...) on the backend route. Axios sets the
// correct Content-Type (including the multipart boundary) automatically
// when given a FormData body, so it isn't set explicitly here.
export function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('avatar', file);
  return api.post<ManagedUser>('/users/me/avatar', formData);
}

// Reverts to the initial-letter placeholder — no body, same idempotent
// shape as the backend's DELETE /users/me/avatar.
export function deleteAvatar() {
  return api.delete<ManagedUser>('/users/me/avatar');
}
