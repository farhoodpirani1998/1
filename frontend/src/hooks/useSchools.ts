import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSchools,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.list() });
    },
  });
}

export function useDeactivateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSchool(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schools.list() });
    },
  });
}
