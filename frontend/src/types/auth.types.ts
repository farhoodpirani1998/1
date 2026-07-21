// Auth domain types.
// Mirrors the actual backend models 1:1 (see modules/auth/* entities and dto).
// Do NOT add fields/concepts here that don't exist on the backend —
// see Audit-Phase0 report for why speculative fields were removed.

import type { ManagedUser } from './user.types';

// 'teacher' added in Sprint 1 of the Teacher Portal — mirrors Role.TEACHER
// on the backend (common/authorization/roles.enum.ts), same isolation
// shape as 'parent' (never granted on staff-facing endpoints, only on its
// own dedicated /teacher/* route group — see App.tsx).
//
// 'founder' — Founder Dashboard sprint. Owns one or more schools and gets
// read-only access to aggregated + per-school data under /founder/*
// (see founder-frontend-prompt.md). schoolId is always null for this
// role, same as super_admin (a founder isn't scoped to one school).
//
// 'student' — Student Portal foundation (ADR-001). Mirrors Role.STUDENT
// on the backend. Logs in with `username` + password rather than
// `phone` (see LoginDto — username is a student-only identifier), and
// always owns a schoolId like every non-super_admin/founder role. Same
// isolation shape as parent/teacher/founder: never granted on
// staff-facing endpoints, only on its own dedicated /student/* route
// group (see App.tsx).
export type UserRole =
  | 'super_admin'
  | 'school_admin'
  | 'accountant'
  | 'staff'
  | 'parent'
  | 'teacher'
  | 'founder'
  | 'student';

export interface AuthUser {
  id: string;
  schoolId: string;
  role: UserRole;
  fullName: string;
  // Sprint P1 — Universal Avatar System. Mirrors User.avatarUrl on the
  // backend (relative URL under /uploads/avatars, see
  // AddAvatarUrlToUsers migration + AvatarStorageService). Null for
  // every user who hasn't uploaded a photo — every consumer (Avatar
  // component) already falls back to the initial-letter placeholder in
  // that case.
  avatarUrl: string | null;
}

// POST /auth/login and /auth/register both return the same shape:
// { accessToken, user: <all User columns except passwordHash> }.
// ManagedUser already matches that "safe user" shape field-for-field, so
// it's reused here instead of the untyped `Omit<AuthUser, never> &
// Record<string, unknown>` hack from an earlier draft (fixed in
// Phase 1.5 — see that report; reapplied here after the types/ split
// reintroduced it).
export interface LoginResponse {
  accessToken: string;
  user: ManagedUser;
  // Present only for a student-role login, resolved server-side via the
  // student_users link table (see AuthService.login). Not needed by any
  // /student/* request today — every one of those routes resolves the
  // caller's own student record from the token's user id, never from a
  // client-supplied id — but typed here so the login response shape is
  // complete and doesn't silently drop a field the backend actually sends.
  studentId?: string;
}
