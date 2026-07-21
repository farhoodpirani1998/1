import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  getAttendance,
  getAssessments,
  getReportCard,
  getHomework,
  submitHomework,
  getAnnouncements,
  getDocuments,
  getTimetable,
  getDashboard,
} from '../api/student.api';
import { queryKeys } from '../lib/queryKeys';

// Student Portal foundation (ADR-001). Named useStudentPortal.ts rather
// than useStudent.ts — that file already exists (the admin-side
// single-student detail hook, hooks/useStudent.ts) — same naming split
// as api/student.api.ts alongside api/students.api.ts.
//
// Every hook below is read-only, same "query only, nothing to
// invalidate" shape as the Teacher Portal's own read-only hooks
// (useTeacherTimetable, useTeacherAnnouncements) — foundation only, ready
// for the sprints that build the pages using them. Sprint H2 adds this
// portal's first (and so far only) mutation, useSubmitHomework() below,
// wired into StudentHomeworkPage.

// GET /student/profile.
export function useStudentProfile() {
  return useQuery({
    queryKey: queryKeys.studentPortal.profile(),
    queryFn: () => getProfile().then((res) => res.data),
  });
}

// GET /student/attendance.
export function useStudentAttendance() {
  return useQuery({
    queryKey: queryKeys.studentPortal.attendance(),
    queryFn: () => getAttendance().then((res) => res.data),
  });
}

// GET /student/assessments.
export function useStudentAssessments() {
  return useQuery({
    queryKey: queryKeys.studentPortal.assessments(),
    queryFn: () => getAssessments().then((res) => res.data),
  });
}

// GET /student/report-card.
export function useStudentReportCard() {
  return useQuery({
    queryKey: queryKeys.studentPortal.reportCard(),
    queryFn: () => getReportCard().then((res) => res.data),
  });
}

// GET /student/homework.
export function useStudentHomework() {
  return useQuery({
    queryKey: queryKeys.studentPortal.homework(),
    queryFn: () => getHomework().then((res) => res.data),
  });
}

// POST /student/homework/:homeworkId/submit — Sprint H2. The portal's
// first write. Invalidates ONLY queryKeys.studentPortal.homework() (no
// manual cache write/patch) — the backend's own upsert-on-resubmit
// already means a second call for the same homeworkId corrects the
// existing row rather than creating a second one, so a plain invalidate
// + refetch is enough to bring StudentHomeworkPage's list back in sync,
// same "invalidate the one query this write can affect, let React Query
// refetch" shape useRecordAttendanceAdmin() already uses.
export function useSubmitHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (homeworkId: string) => submitHomework(homeworkId).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentPortal.homework() });
    },
  });
}

// GET /student/announcements.
export function useStudentAnnouncements() {
  return useQuery({
    queryKey: queryKeys.studentPortal.announcements(),
    queryFn: () => getAnnouncements().then((res) => res.data),
  });
}

// GET /student/documents.
export function useStudentDocuments() {
  return useQuery({
    queryKey: queryKeys.studentPortal.documents(),
    queryFn: () => getDocuments().then((res) => res.data),
  });
}

// GET /student/timetable.
export function useStudentTimetable() {
  return useQuery({
    queryKey: queryKeys.studentPortal.timetable(),
    queryFn: () => getTimetable().then((res) => res.data),
  });
}

// GET /student/dashboard — single aggregate read. Prefer this hook for
// the Dashboard page instead of composing the individual hooks above in
// parallel (see api/student.api.ts's getDashboard doc comment).
export function useStudentDashboard() {
  return useQuery({
    queryKey: queryKeys.studentPortal.dashboard(),
    queryFn: () => getDashboard().then((res) => res.data),
  });
}
