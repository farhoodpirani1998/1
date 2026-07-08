// Single-student detail query, kept separate from useStudents.ts per the
// Phase 2 plan (list concerns vs. one-entity concerns).

import { useQuery } from '@tanstack/react-query';
import { getStudent } from '../api/students.api';
import { queryKeys } from '../lib/queryKeys';

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.detail(id ?? ''),
    queryFn: () => getStudent(id as string).then((res) => res.data),
    enabled: !!id,
  });
}
