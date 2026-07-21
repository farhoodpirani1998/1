// Single-student detail query, kept separate from useStudents.ts per the
// Phase 2 plan (list concerns vs. one-entity concerns).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStudent,
  addStudentParent,
  getStudentParents,
  getStudentProfile,
  getStudentAccount,
  provisionStudentAccount,
  updateStudentAccount,
  type AddStudentParentInput,
  type ProvisionStudentAccountInput,
  type UpdateStudentAccountInput,
} from '../api/students.api';
import { unlinkParentStudent } from '../api/parent.api';
import {
  getStudentDocuments,
  createStudentDocument,
  deleteStudentDocument,
  type CreateStudentDocumentInput,
} from '../api/studentDocuments.api';
import { queryKeys } from '../lib/queryKeys';

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.detail(id ?? ''),
    queryFn: () => getStudent(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

// GET /students/:id/parents — the "والدین" section on StudentDetailPage.
export function useStudentParents(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.parents(studentId ?? ''),
    queryFn: () => getStudentParents(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}

// POST /students/:id/parent — create-or-link. Invalidates just this
// student's parents list; nothing else embeds parent-account data.
export function useAddStudentParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, dto }: { studentId: string; dto: AddStudentParentInput }) =>
      addStudentParent(studentId, dto).then((res) => res.data),
    onSuccess: (_data, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.parents(studentId) });
    },
  });
}

// DELETE /parent/link/:id — removes one linked parent from a student.
export function useRemoveStudentParent(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => unlinkParentStudent(linkId),
    onSuccess: () => {
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.parents(studentId) });
      }
    },
  });
}

// GET /students/:id/documents — the "مدارک" section on StudentDetailPage.
export function useStudentDocuments(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.documents(studentId ?? ''),
    queryFn: () => getStudentDocuments(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}

// POST /students/:id/documents
export function useCreateStudentDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, dto }: { studentId: string; dto: CreateStudentDocumentInput }) =>
      createStudentDocument(studentId, dto).then((res) => res.data),
    onSuccess: (_data, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.documents(studentId) });
    },
  });
}

// DELETE /documents/:id — the "حذف مدرک" action in the "مدارک" section.
export function useDeleteStudentDocument(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteStudentDocument(documentId).then((res) => res.data),
    onSuccess: () => {
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.documents(studentId) });
      }
    },
  });
}

// GET /students/:id/profile — the shared <StudentProfileModal/> data
// source for the school_admin/accountant portal. `id` undefined (modal
// closed / no student picked) leaves the query disabled, same pattern
// as useStudent above.
export function useStudentProfile(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.profile(id ?? ''),
    queryFn: () => getStudentProfile(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

// GET /students/:id/account — the "حساب پرتال دانش‌آموز" section on
// StudentDetailPage. Same "id or disabled" shape as useStudent/
// useStudentProfile above.
export function useStudentAccount(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.students.account(id ?? ''),
    queryFn: () => getStudentAccount(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

// POST /students/:id/account — creates the student's portal login.
// Invalidates just this student's account-status query; nothing else
// embeds account data.
export function useProvisionStudentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, dto }: { studentId: string; dto: ProvisionStudentAccountInput }) =>
      provisionStudentAccount(studentId, dto).then((res) => res.data),
    onSuccess: (_data, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.account(studentId) });
    },
  });
}

// PATCH /students/:id/account — resets the student's password and/or
// toggles portal access. Same invalidation footprint as
// useProvisionStudentAccount above.
export function useUpdateStudentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, dto }: { studentId: string; dto: UpdateStudentAccountInput }) =>
      updateStudentAccount(studentId, dto).then((res) => res.data),
    onSuccess: (_data, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.account(studentId) });
    },
  });
}
