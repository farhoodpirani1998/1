import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, resetUserPassword, type UpdateUserInput } from '../api/users.api';
import type { RegisterUserInput } from '../api/auth.api';
import { queryKeys } from '../lib/queryKeys';

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
