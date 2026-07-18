// Single-student detail query, kept separate from useStudents.ts per the
// Phase 2 plan (list concerns vs. one-entity concerns).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStudent,
  addStudentParent,
  getStudentParents,
  type AddStudentParentInput,
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

// DELETE /documents/:id
export function useDeleteStudentDocument(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteStudentDocument(documentId),
    onSuccess: () => {
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.documents(studentId) });
      }
    },
  });
}
