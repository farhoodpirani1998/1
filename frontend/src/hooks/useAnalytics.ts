import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/analytics.api';
import { queryKeys } from '../lib/queryKeys';

// school_admin only — see analytics.api.ts.
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(),
    queryFn: () => getDashboard().then((res) => res.data),
  });
}
