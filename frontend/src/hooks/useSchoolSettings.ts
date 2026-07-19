import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSchoolSettings, updateSchoolSettings, type UpdateSchoolSettingsInput } from '../api/school-settings.api';
import { queryKeys } from '../lib/queryKeys';
import { useAuth } from '../lib/auth';

// GET /settings is school_admin-only on the backend — `enabled` keeps
// this from firing (and 403ing) for any other signed-in role, same
// pattern other role-gated queries in this app use.
export function useSchoolSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.schoolSettings.all(),
    queryFn: () => getSchoolSettings().then((res) => res.data),
    enabled: user?.role === 'school_admin',
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateSchoolSettingsInput) => updateSchoolSettings(dto).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.schoolSettings.all(), data);
    },
  });
}
