// Sprint 2B: hooks for the school-wide Subject reference list. Added
// for TeacherAssignmentsPage's subject picker — same shape/staleTime
// reasoning as useGrades() in hooks/useStudents.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSubjects, createSubject, type CreateSubjectInput } from '../api/subjects.api';
import { queryKeys } from '../lib/queryKeys';

// Rarely changes; safe to treat as long-lived reference data.
export function useSubjects() {
  return useQuery({
    queryKey: queryKeys.subjects.list(),
    queryFn: () => listSubjects().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

// school_admin-only on the backend (SubjectsController.create). Same
// shape as useCreateGrade in hooks/useStudents.ts — invalidate the list
// so a newly created subject shows up immediately everywhere useSubjects()
// is read (SubjectsPanel below and TeacherAssignmentsPage's picker).
export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSubjectInput) => createSubject(dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.list() });
    },
  });
}
