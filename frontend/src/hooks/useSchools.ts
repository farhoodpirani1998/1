import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSchools,
  getSchool,
  createSchool,
  updateSchool,
  deactivateSchool,
  type CreateSchoolInput,
  type UpdateSchoolInput,
} from '../api/schools.api';
import { queryKeys } from '../lib/queryKeys';

export function useSchools() {
  return useQuery({
    queryKey: queryKeys.schools.list(),
    queryFn: () => getSchools().then((res) => res.data),
  });
}

export function useSchool(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.schools.detail(id ?? ''),
    queryFn: () => getSchool(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSchoolInput) => createSchool(dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.list() });
    },
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSchoolInput }) =>
      updateSchool(id, dto).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.detail(variables.id) });
    },
  });
}

export function useDeactivateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSchool(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.detail(id) });
    },
  });
}
