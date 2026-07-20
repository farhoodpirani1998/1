import { useQuery } from '@tanstack/react-query';
import {
  getProfile,
  getAttendance,
  getAssessments,
  getReportCard,
  getHomework,
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
// (useTeacherTimetable, useTeacherAnnouncements) — this portal has no
// mutations. Foundation only: these hooks aren't wired into any page
// yet (the Dashboard/feature pages are placeholders for now), but are
// ready for the sprints that build them.

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
