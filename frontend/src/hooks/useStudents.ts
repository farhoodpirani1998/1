// Student list + reference-data (Grade, AcademicYear) hooks.
//
// NOTE ON SCOPE: the Phase 2 plan named useStudents.ts / useStudent.ts
// but didn't list separate files for Grade/AcademicYear. Those two are
// small, rarely-changing reference lists that only ever get *read*
// alongside students (pickers in StudentsPage/StudentDetailPage) or
// *written* from SettingsPage — there's no natural "useGrades.ts is its
// own migration stage" in the plan. They're kept here rather than
// invented as new files; flagged in the migration report.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStudents,
  createStudent,
  updateStudent,
  archiveStudent,
  restoreStudent,
  type QueryStudentsParams,
  type CreateStudentInput,
  type UpdateStudentInput,
} from '../api/students.api';
import { getGrades, createGrade, type CreateGradeInput } from '../api/grades.api';
import {
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  type CreateAcademicYearInput,
  type UpdateAcademicYearInput,
} from '../api/academic-years.api';
import { queryKeys } from '../lib/queryKeys';

// ---- Students -------------------------------------------------------

export function useStudents(params?: QueryStudentsParams) {
  return useQuery({
    queryKey: queryKeys.students.list(params),
    queryFn: () => getStudents(params).then((res) => res.data),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStudentInput) => createStudent(dto).then((res) => res.data),
    onSuccess: () => {
      // A brand-new student can appear in any filtered list (search,
      // status, grade, academicYear) — invalidate every students list
      // rather than guessing which filter combos are affected.
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStudentInput }) =>
      updateStudent(id, dto).then((res) => res.data),
    onSuccess: (_data, { id }) => {
      // status/grade/fullName changes affect: the detail page itself,
      // every students list (status filter membership can change — e.g.
      // active -> withdrawn moves the row between StudentsPage and
      // ArchivedStudentsPage), and StudentDetailPage's statement header
      // (student.fullName / grade are echoed there).
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.studentStatement(id) });
    },
  });
}

export function useArchiveStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveStudent(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(id) });
    },
  });
}

// restoreStudent is just updateStudent({status:'active'}) under the hood
// (see students.api.ts) — same invalidation footprint as useUpdateStudent.
export function useRestoreStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreStudent(id).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(id) });
    },
  });
}

// ---- Grades -----------------------------------------------------------

// Rarely changes; safe to treat as long-lived reference data.
export function useGrades() {
  return useQuery({
    queryKey: queryKeys.grades.list(),
    queryFn: () => getGrades().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGradeInput) => createGrade(dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grades.list() });
    },
  });
}

// ---- Academic years -----------------------------------------------------

export function useAcademicYears() {
  return useQuery({
    queryKey: queryKeys.academicYears.list(),
    queryFn: () => getAcademicYears().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAcademicYearInput) => createAcademicYear(dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicYears.list() });
    },
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAcademicYearInput }) =>
      updateAcademicYear(id, dto).then((res) => res.data),
    onSuccess: () => {
      // e.g. "set as current" flips isCurrent on two rows at once
      // (old current -> false, new one -> true) — invalidate the whole
      // list rather than trying to patch two cache entries by hand.
      queryClient.invalidateQueries({ queryKey: queryKeys.academicYears.list() });
      // Student rows embed a denormalized `academicYear` object
      // (see student.types.ts) — its isCurrent flag would otherwise go
      // stale in any already-cached student list.
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    },
  });
}
