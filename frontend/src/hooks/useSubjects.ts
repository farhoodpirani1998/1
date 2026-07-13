// Sprint 2B: hooks for the school-wide Subject reference list. Added
// for TeacherAssignmentsPage's subject picker — same shape/staleTime
// reasoning as useGrades() in hooks/useStudents.ts.

import { useQuery } from '@tanstack/react-query';
import { listSubjects } from '../api/subjects.api';
import { queryKeys } from '../lib/queryKeys';

// Rarely changes; safe to treat as long-lived reference data.
export function useSubjects() {
  return useQuery({
    queryKey: queryKeys.subjects.list(),
    queryFn: () => listSubjects().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}
