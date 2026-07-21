import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  uploadAvatar,
  deleteAvatar,
  getMyProfile,
  updateMyProfile,
  type UpdateUserInput,
  type UpdateProfileInput,
} from '../api/users.api';
import { changePassword, type RegisterUserInput, type ChangePasswordInput } from '../api/auth.api';
import { queryKeys } from '../lib/queryKeys';
import { useAuth } from '../lib/auth';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => getUsers().then((res) => res.data),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RegisterUserInput) => createUser(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & UpdateUserInput) =>
      updateUser(id, dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      resetUserPassword(id, newPassword).then((res) => res.data),
  });
}

// Sprint A3 — My Profile. GET /users/me — every role's own account
// page. Distinct from useUsers() above (the super_admin-only admin
// list): this is a single-shot "my own record" read, same shape as
// useTeacher's profile query.
export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.myProfile.all(),
    queryFn: () => getMyProfile().then((res) => res.data),
  });
}

// Sprint A3 — My Profile. PATCH /users/me — fullName/phone only (see
// UpdateProfileInput). Per the AuthUser/MyProfile split: AuthUser (the
// session model) stays lightweight, so only the field it already
// carries (fullName) is pushed into it on success — phone/username live
// only in the myProfile cache, which is invalidated instead of
// duplicated onto the session.
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const { updateUser: updateAuthUser } = useAuth();
  return useMutation({
    mutationFn: (dto: UpdateProfileInput) => updateMyProfile(dto).then((res) => res.data),
    onSuccess: (data) => {
      updateAuthUser({ fullName: data.fullName });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile.all() });
    },
  });
}

// Sprint A3 — My Profile. POST /auth/change-password — no cache to
// invalidate (nothing about the current session's data changes; the
// backend just bumps tokenVersion, which only affects *other* sessions
// on next request).
export function useChangePassword() {
  return useMutation({
    mutationFn: (dto: ChangePasswordInput) => changePassword(dto).then((res) => res.data),
  });
}

// Sprint P1 — Universal Avatar System. Both hooks below push the
// returned avatarUrl straight into AuthContext (see AuthProvider.
// updateUser) so Topbar/Sidebar re-render with the new photo
// immediately — no re-login, no waiting on a query refetch. They also
// invalidate the admin users list, in case a super_admin has it open at
// the same time (same "any user mutation invalidates the list" pattern
// useCreateUser/useUpdateUser above already follow).
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { updateUser: updateAuthUser } = useAuth();
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file).then((res) => res.data),
    onSuccess: (data) => {
      updateAuthUser({ avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile.all() });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  const { updateUser: updateAuthUser } = useAuth();
  return useMutation({
    mutationFn: () => deleteAvatar().then((res) => res.data),
    onSuccess: (data) => {
      updateAuthUser({ avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile.all() });
    },
  });
}
