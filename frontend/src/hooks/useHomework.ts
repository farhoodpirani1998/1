import { useQuery } from '@tanstack/react-query';
import { getHomeworkDetail } from '../api/homework.api';
import { queryKeys } from '../lib/queryKeys';

// GET /homework/:id — the homework detail page linked from Global Search
// results.
export function useHomeworkDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminHomework.detail(id ?? ''),
    queryFn: () => getHomeworkDetail(id as string).then((res) => res.data),
    enabled: !!id,
  });
}
