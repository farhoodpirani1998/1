// Sprint 2B: hooks for the school-wide Subject reference list. Added
// for TeacherAssignmentsPage's subject picker — same shape/staleTime
// reasoning as useGrades() in hooks/useStudents.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  type CreateSubjectInput,
  type UpdateSubjectInput,
} from '../api/subjects.api';
import { queryKeys } from '../lib/queryKeys';

// Rarely changes; safe to treat as long-lived reference data.
export function useSubjects() {
  return useQuery({
    queryKey: queryKeys.subjects.list(),
    queryFn: () => listSubjects().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

// GET /subjects/:id — the subject detail page linked from Global Search
// results.
export function useSubject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.subjects.detail(id ?? ''),
    queryFn: () => getSubject(id as string).then((res) => res.data),
    enabled: !!id,
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

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSubjectInput }) =>
      updateSubject(id, dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.list() });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.list() });
    },
  });
}
