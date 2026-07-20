# Changelog — Production Merge (Golden Backup + Backup Integration Build)

This merge combines two divergent frontend branches on top of a shared,
unmodified backend. Backend `src/` was byte-identical between both source
archives (confirmed via full recursive diff) and required zero changes.

**Base used:** `TuitionSchool_backup.zip` (Version B) — already an
integrated build of 5 approved sprints (Analytics Dashboard, Skeleton
loading, Row Selection/Export, Grade/Year Filters, One-step Payment Flow +
Staff Dashboard).

**Merged in:** Parent Portal feature branch from
`TuitionSchool-GoldenBackup-2026-07-12-final-1.zip` (Version A).

## Files copied unchanged from the Parent Portal branch (no overlap with B)
```
frontend/src/api/parent.api.ts
frontend/src/api/parentPasswordReset.mock.ts
frontend/src/components/ParentAuthShell.tsx
frontend/src/components/StudentSwitcher.tsx
frontend/src/components/InfoRow.tsx
frontend/src/hooks/useParent.ts
frontend/src/hooks/usePasswordReset.ts
frontend/src/lib/parentStudent.tsx
frontend/src/types/parent.types.ts
frontend/src/pages/parent/ParentLoginPage.tsx
frontend/src/pages/parent/ParentForgotPasswordPage.tsx
frontend/src/pages/parent/ParentDashboardPage.tsx
frontend/src/pages/parent/ParentTuitionPage.tsx
frontend/src/pages/parent/ParentInstallmentsPage.tsx
frontend/src/pages/parent/ParentPaymentsPage.tsx
```

## Files kept unchanged from Version B (Sprint 1–5 work, untouched)
```
frontend/src/api/analytics.api.ts
frontend/src/hooks/useAnalytics.ts
frontend/src/hooks/useDebouncedValue.ts
frontend/src/hooks/useTableSort.ts
frontend/src/types/analytics.types.ts
frontend/src/components/RecordPaymentModal.tsx   (one-step payment flow)
frontend/src/pages/InstallmentsPage.tsx          (bulk select/export + skeleton)
frontend/src/pages/StudentsPage.tsx              (grade/year filters)
frontend/src/pages/DashboardPage.tsx             (analytics + staff dashboard) *
frontend/src/pages/StudentDetailPage.tsx         (receipt studentName fix) *
```
\* Two small edits applied — see "Hand-merged" below.

## Hand-merged files (both branches touched, changes combined additively)
- **`frontend/src/api/index.ts`** — added `export * from './parent.api'`
  alongside the existing `analytics.api` export.
- **`frontend/src/lib/queryKeys.ts`** — added the `parent` key namespace
  alongside the existing `analytics` namespace. No key collisions.
- **`frontend/src/App.tsx`** — added `/parent/login`, `/parent/forgot-password`
  public routes and the `/parent/*` protected route group
  (`RequireRole roles={['parent']}` + `ParentStudentProvider`), layered onto
  B's existing route tree. All of B's admin/staff routes are untouched.
- **`frontend/src/components/AppLayout.tsx`** — added the optional
  `loginPath` prop (defaults to `/login`) so the parent route group can
  redirect unauthenticated visits to `/parent/login` instead of the staff
  login page. Default behavior for every existing call site is unchanged.
- **`frontend/src/components/Sidebar.tsx`** — added the four parent nav
  items (`/parent/dashboard`, `/tuition`, `/installments`, `/payments`),
  the `parent` role label, the parent-specific header text, and the two
  new icon components (`TuitionIcon`, `PaymentsIcon`) those items use.
  Existing nav items and their roles are unchanged.
- **`frontend/src/components/Topbar.tsx`** — added the `parent` role
  label to the existing `roleLabels` map.
- **`frontend/src/types/auth.types.ts`** — added `'parent'` to the
  `UserRole` union.
- **`frontend/src/lib/format.ts`** — added the shared `paymentMethodLabels`
  export (previously duplicated locally in `DashboardPage.tsx`).
- **`frontend/src/pages/UsersPage.tsx`** — added a `parent: 'والد'` entry
  to that page's local `roleLabels` map, required for type exhaustiveness
  now that `UserRole` includes `'parent'`. The role is **not** added to
  the create/filter select options — admins still can't create parent
  accounts from this page, matching current behavior. This is a type-safety
  fix only, no behavior change.

## Duplicate code found and resolved
- **`InfoRow` component** — Version A extracted this into a shared
  `components/InfoRow.tsx` (used by Parent Portal pages too). Version B's
  sprint 5 independently redefined the identical component locally inside
  `StudentDetailPage.tsx`. Resolved by removing B's local copy and
  importing the shared component instead — same render output, no
  duplicate definitions in the bundle.
- **`paymentMethodLabels`** — same pattern: A had already extracted this
  into `format.ts`; B's `DashboardPage.tsx` still had its own local copy.
  Removed the local copy, both now import the shared constant.

## Pre-existing gap fixed (unrelated to this merge, blocked a clean build)
- **`frontend/src/components/Table.tsx`** — added `export type SortDirection
  = 'asc' | 'desc'`. `hooks/useTableSort.ts` (staged in Version B for a
  future sortable-column feature, not yet wired into any page) imported
  this type from `Table.tsx`, but it was never exported there. This existed
  in Version B before the merge and is unrelated to the Parent Portal
  integration; fixed here only because it blocked `tsc -b` from completing.
  `useTableSort` remains unused by any page — no behavior change.

## Verification performed
- `tsc -b --force`: **0 errors** (project has `noUnusedLocals` and
  `noUnusedParameters` enabled, so this also confirms no unused imports
  anywhere in the codebase)
- `vite build`: succeeds, single bundle, no errors (one pre-existing
  chunk-size advisory warning, not an error, not introduced by this merge)
- `nest build` (backend): succeeds — backend was not modified
- All 15 routes in `App.tsx` verified against Sidebar nav targets — no
  orphaned links, no missing routes
- All React Query hooks confirmed to source their keys from the central
  `queryKeys` registry (19 `useQuery` call sites checked) — no hand-built
  keys, no collisions between the `analytics` and `parent` namespaces
  added by the two branches
- Grep-verified no duplicate hook/API function names across `hooks/` and
  `api/`
- Role guards cross-checked: `RequireRole` gates every admin/staff route
  exactly as before, plus the new `['parent']`-gated route group

## Not touched
- Entire `backend/` (byte-identical between both source versions)
- `package.json`, `package-lock.json`, `tsconfig.json`, `tailwind.config.js`
  (identical between both source versions)

## Manual step required before running
Both source archives shipped different local `.env` values (DB
credentials, JWT secret, seed admin credentials). Neither was carried
into this archive's `backend/.env` blindly — **set your own values in
`backend/.env` before starting the server** (see `backend/.env.example`
for the full list of required variables and the production-boot checks
in `src/config/env.validation.ts`).

---

## Merge 2: Class/Section feature (Tuition-class-section-fix → Tuition)

Merged the "کلاس" (class/section) feature from the `Tuition-class-section-fix`
branch into this (feature-ahead) `Tuition` codebase. The class-fix branch
was behind on frontend features (no HomeworkSubmissionsModal,
StudentProfileModal, homework/attendance extras, error boundary, etc.),
so this was a manual field-by-field merge rather than a file overwrite,
to avoid losing anything already in this codebase.

### Backend — added
- New `classes` module (controller/service/module/dto/entity)
- 3 migrations: `CreateClasses`, `AddClassIdToStudents`,
  `AddClassIdToTeacherAssignments`
- `app.module.ts`: registers `ClassesModule`
- `Student` entity/DTOs: nullable `classId` + `class` relation, with
  (grade, academicYear) consistency checks in `StudentsService`
- `TeacherAssignment` entity/DTOs: nullable `classId` (NULL = whole
  grade, same as before; a real id scopes the assignment to one section)
- `TeacherService`: `assign()`, `getMyStudents()`, `recordAttendance()`,
  `recordAssessment()` now section-aware (`assignmentCoversStudent()`
  helper). **`getStudentProfile()` — a feature that only existed in this
  branch, not in class-fix — was preserved and its access check updated
  to use the same section-aware rule**, instead of being dropped.

### Frontend — added
- `api/classes.api.ts`, `hooks/useStudents.ts` (`useClasses` +
  create/update/delete), `queryKeys.classes`
- `types/student.types.ts`: `SchoolClass`, `Student.classId`/`Student.class`
- `SettingsPage.tsx`: new `ClassesPanel` (scoped to grade+academicYear)
- `StudentsPage.tsx`: class column, class filter (real, replacing the old
  Sprint 3.1 visual-only placeholder), class picker in the create-student
  form — merged around the existing `StudentProfileModal`/`canViewProfile`
  feature rather than removing it
- `TeacherAssignmentsPage.tsx`: class picker when assigning a teacher to
  a grade (no divergent Tuition-only content in this file — copied as-is
  from class-fix)
- `api/teacher.api.ts`: `classId` on assignment create/view,
  `getTeacherStudents(gradeId, classId)`

### Explicitly NOT touched (verified no class-related changes existed)
- `TeacherAssessmentsPage.tsx`, `TeacherAttendancePage.tsx`,
  `TeacherHomeworkPage.tsx`, `TeacherStudentsPage.tsx` — the class-fix
  branch made no class-scoping changes to these four pages; their
  differences vs. this branch are all pre-existing Tuition-only features
  (bulk score entry/undo-redo, previous-session copy, homework extras,
  profile modal) and were left as-is.
- `App.tsx`, `index.html`, `lib/auth.tsx`, `lib/theme.tsx` — differences
  here are an unrelated error-boundary/localStorage-hardening feature
  already in this branch; not part of the class feature, left as-is.

### Verification performed
- Manual `diff -rq` of every backend and frontend file against the
  class-fix source after merging: remaining diffs are exclusively the
  Tuition-only features listed above (confirmed line-by-line), nothing
  class-related was missed.
- Brace/paren balance check on every hand-edited file.
- **Not run** (no network / no `node_modules` in this environment):
  `tsc -b`, `vite build`, `nest build`. Recommend running the full build
  + typecheck before deploying — this merge was done via careful manual
  diffing, not a compiler-verified merge.
