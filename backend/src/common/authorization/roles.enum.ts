/**
 * The four roles that exist today. Values are the exact strings already
 * stored in `users.role` and signed into the JWT payload (see
 * AuthService.login / JwtStrategy) — this enum adds type-safety and a
 * single place to reference "super_admin" etc. from, it does NOT change
 * what's stored in the DB or the token. No migration needed.
 *
 * Intentionally NOT used to retype `@Roles(...)` call sites across every
 * controller — those already work correctly with plain strings, and
 * changing their signature to accept only `Role` would mean touching every
 * controller for no behavioral gain (see the authorization discussion:
 * that's the over-engineering line we agreed not to cross). This enum is
 * for the small number of places that had `'super_admin'` typed by hand as
 * an actual business-logic check (RolesGuard, permissions.ts, seed.ts,
 * register.dto.ts's allow-list) — those now import from here instead of
 * re-typing the string, so there's exactly one place to change if a role
 * is ever renamed.
 */
export enum Role {
  SUPER_ADMIN = 'super_admin',
  SCHOOL_ADMIN = 'school_admin',
  ACCOUNTANT = 'accountant',
  STAFF = 'staff',
  // Phase 5A: read-only portal access for a student's parent/guardian
  // login. Never gets a @Roles() grant on any staff-facing endpoint —
  // only on the dedicated /parent/* routes in modules/parent. See
  // ParentStudent (modules/parent/entities/parent-student.entity.ts) for
  // how a parent user is scoped to specific students.
  PARENT = 'parent',
  // Phase 5G: a teaching-staff login, scoped to only the grade+subject
  // combinations they've been explicitly assigned (see TeacherAssignment,
  // modules/teacher/entities/teacher-assignment.entity.ts). Never gets a
  // @Roles() grant on any other staff-facing endpoint — only on the
  // dedicated /teacher/* routes in modules/teacher, same isolation shape
  // as PARENT and /parent/*.
  TEACHER = 'teacher',
}
