import { useQuery } from '@tanstack/react-query';
import { search } from '../api/search.api';
import { queryKeys } from '../lib/queryKeys';

// Phase 5N: Global Search. `enabled` is gated on a non-empty trimmed
// query so the dropdown never fires GET /search with q='' (the backend
// rejects it anyway — QuerySearchDto.q is @IsNotEmpty) and so clearing
// the box simply stops querying instead of erroring.
export function useGlobalSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.search.query({ q: trimmed }),
    queryFn: () => search({ q: trimmed }).then((res) => res.data),
    enabled: trimmed.length > 0,
  });
}
