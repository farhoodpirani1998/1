import { useQuery } from '@tanstack/react-query';
import {
  getMyStudents,
  getStudentTuition,
  getStudentInstallments,
  getStudentPaymentHistory,
  getMyAnnouncements,
} from '../api/parent.api';
import { queryKeys } from '../lib/queryKeys';

// GET /parent/students. Every parent-portal page needs this list to know
// which child/children the signed-in parent may see.
export function useMyStudents() {
  return useQuery({
    queryKey: queryKeys.parent.students(),
    queryFn: () => getMyStudents().then((res) => res.data),
  });
}

export function useStudentTuition(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.parent.tuition(studentId ?? ''),
    queryFn: () => getStudentTuition(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}

export function useStudentInstallments(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.parent.installments(studentId ?? ''),
    queryFn: () => getStudentInstallments(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}

export function useStudentPayments(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.parent.payments(studentId ?? ''),
    queryFn: () => getStudentPaymentHistory(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}

export function useMyAnnouncements() {
  return useQuery({
    queryKey: queryKeys.parent.announcements(),
    queryFn: () => getMyAnnouncements().then((res) => res.data),
  });
}
