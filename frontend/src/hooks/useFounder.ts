import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getFounderSchools,
  getFounderOverview,
  getFounderSchoolDashboard,
  getFounderSchoolStudents,
  getFounderSchoolTeachers,
  getFounderTeachers,
  getFounderSchoolStaff,
  getFounderSchoolTuition,
  linkFounderToSchool,
  unlinkFounderFromSchool,
  type FounderSchoolDashboardParams,
} from '../api/founder.api';
import { queryKeys } from '../lib/queryKeys';
import type { QueryFounderStudentsParams } from '../types/founder.types';

// GET /founder/schools. Every founder-portal page either reads this
// directly (the school switcher) or indirectly needs it loaded first
// (FounderSchoolLayout's not-found check) — same "load list first" shape
// as useMyStudents() for the parent portal.
export function useFounderSchools() {
  return useQuery({
    queryKey: queryKeys.founder.schools(),
    queryFn: () => getFounderSchools().then((res) => res.data),
  });
}

export function useFounderOverview() {
  return useQuery({
    queryKey: queryKeys.founder.overview(),
    queryFn: () => getFounderOverview().then((res) => res.data),
  });
}

// retry:false on every school-scoped query below: a 404 here means "not
// your school" (stale/manipulated schoolId in the URL — see
// founder-frontend-prompt.md §4), not a flaky request worth retrying.
export function useFounderSchoolDashboard(schoolId: string | undefined, params?: FounderSchoolDashboardParams) {
  return useQuery({
    queryKey: queryKeys.founder.dashboard(schoolId ?? '', params),
    queryFn: () => getFounderSchoolDashboard(schoolId as string, params).then((res) => res.data),
    enabled: !!schoolId,
    retry: false,
  });
}

export function useFounderSchoolStudents(schoolId: string | undefined, params?: QueryFounderStudentsParams) {
  return useQuery({
    queryKey: queryKeys.founder.students(schoolId ?? '', params),
    queryFn: () => getFounderSchoolStudents(schoolId as string, params).then((res) => res.data),
    enabled: !!schoolId,
    retry: false,
  });
}

export function useFounderSchoolTeachers(schoolId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.founder.teachers(schoolId ?? ''),
    queryFn: () => getFounderSchoolTeachers(schoolId as string).then((res) => res.data),
    enabled: !!schoolId,
    retry: false,
  });
}

// GET /founder/teachers — cross-school directory, not scoped to one
// :schoolId so no `enabled`/`retry:false` gate is needed (unlike the
// school-scoped queries above).
export function useFounderTeachers() {
  return useQuery({
    queryKey: queryKeys.founder.allTeachers(),
    queryFn: () => getFounderTeachers().then((res) => res.data),
  });
}

export function useFounderSchoolStaff(schoolId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.founder.staff(schoolId ?? ''),
    queryFn: () => getFounderSchoolStaff(schoolId as string).then((res) => res.data),
    enabled: !!schoolId,
    retry: false,
  });
}

export function useFounderSchoolTuition(schoolId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.founder.tuition(schoolId ?? ''),
    queryFn: () => getFounderSchoolTuition(schoolId as string).then((res) => res.data),
    enabled: !!schoolId,
    retry: false,
  });
}

// --- super_admin ownership management (§3) ---
// No GET /founder/:id/schools exists on the backend to list an already-
// linked founder's schools, so there is nothing here to invalidate a
// "founder's schools" cache entry for — these two mutations only affect
// the founder-portal side (a different login session), not any query a
// super_admin screen currently holds.

export function useLinkFounderToSchool() {
  return useMutation({
    mutationFn: ({ founderId, schoolId }: { founderId: string; schoolId: string }) =>
      linkFounderToSchool(founderId, schoolId).then((res) => res.data),
  });
}

export function useUnlinkFounderFromSchool() {
  return useMutation({
    mutationFn: (linkId: string) => unlinkFounderFromSchool(linkId),
  });
}
