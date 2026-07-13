// Auth domain types.
// Mirrors the actual backend models 1:1 (see modules/auth/* entities and dto).
// Do NOT add fields/concepts here that don't exist on the backend —
// see Audit-Phase0 report for why speculative fields were removed.

import type { ManagedUser } from './user.types';

// 'teacher' added in Sprint 1 of the Teacher Portal — mirrors Role.TEACHER
// on the backend (common/authorization/roles.enum.ts), same isolation
// shape as 'parent' (never granted on staff-facing endpoints, only on its
// own dedicated /teacher/* route group — see App.tsx).
export type UserRole = 'super_admin' | 'school_admin' | 'accountant' | 'staff' | 'parent' | 'teacher';

export interface AuthUser {
  id: string;
  schoolId: string;
  role: UserRole;
  fullName: string;
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
}
