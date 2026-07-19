import { useQuery } from '@tanstack/react-query';
import { getAnnouncementDetail } from '../api/announcements.api';
import { queryKeys } from '../lib/queryKeys';

// GET /announcements/:id — the announcement detail page linked from
// Global Search results.
export function useAnnouncementDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminAnnouncements.detail(id ?? ''),
    queryFn: () => getAnnouncementDetail(id as string).then((res) => res.data),
    enabled: !!id,
  });
}
