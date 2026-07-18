import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGuardians,
  getGuardian,
  updateGuardian,
  type QueryGuardiansParams,
  type UpdateGuardianInput,
} from '../api/guardians.api';
import { queryKeys } from '../lib/queryKeys';

export function useGuardians(params?: QueryGuardiansParams) {
  return useQuery({
    queryKey: queryKeys.guardians.list(params),
    queryFn: () => getGuardians(params).then((res) => res.data),
  });
}

export function useGuardian(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guardians.detail(id ?? ''),
    queryFn: () => getGuardian(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

export function useUpdateGuardian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateGuardianInput }) =>
      updateGuardian(id, dto).then((res) => res.data),
    onSuccess: (_data, { id }) => {
      // A phone/name/nationalId change affects the guardian directory
      // list (search may now match/miss it) and its own detail read.
      queryClient.invalidateQueries({ queryKey: queryKeys.guardians.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.guardians.detail(id) });
    },
  });
}
