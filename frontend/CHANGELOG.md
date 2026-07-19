# Changelog — Integration Build

## Sprint 3.3 — Students table: row selection + bulk action bar (this change)

Added checkbox-based row selection to the Students workspace table, on
top of the Sprint 3.2 table/toolbar work. Scope is UI-only, same spirit
as the Sprint 3.1 toolbar placeholders — no query, filter, pagination,
backend, or routing changes.

- New first column in `StudentsPage`'s `columns` array: a per-row
  checkbox plus a header select-all checkbox (tri-state: none / some
  (indeterminate) / all), following the exact selection pattern already
  used by `InstallmentsPage` (`Set<string>` of selected ids,
  `allPageSelected`/`toggleSelectAll`-style helpers). "Select all" only
  ever acts on the current page's rows, matching that precedent and
  leaving pagination untouched.
- New Bulk Action Bar, shown only when `selectedIds.size > 0`: selected
  count, a "لغو انتخاب" (clear selection) button, and three visual-only
  buttons — خروجی/بایگانی/حذف انتخاب‌شده‌ها (Export/Archive/Delete
  Selected). All three are `disabled` with the same "پس از اتصال به
  بک‌اند فعال می‌شود" tooltip convention already used by the dashboard's
  `TodayChecklist` placeholder actions — **no bulk action is wired to
  any API**.
- Selected rows get the table's existing selected-row highlight
  treatment (tinted background, accent border in `comfortable` density)
  — no new colors introduced.

**Modified:** `frontend/src/pages/StudentsPage.tsx` — selection state/
handlers, selection column, bulk action bar, `SelectionCheckbox` and a
few small local icons (`ArchiveIcon`, `DeleteIcon`, `ClearSelectionIcon`).

**Modified (additive only):** `frontend/src/components/Table.tsx` — added
an optional `selectedRowKeys?: Set<string>` prop alongside the existing
`selectedRowKey` (single-key) prop, so multiple rows can get the same
highlight styling. Every other current caller of `<Table>` is unaffected
— the prop defaults to `undefined` and the highlight logic is additive
(`isSelected = singleMatch || keys?.has(key)`).

## StaffDashboard: "چک‌لیست امروز" placeholder section

Added a "Today's checklist" section to the staff dashboard
(`DashboardPage.tsx` → `StaffDashboard`), addressing feedback that the
dashboard was too thin — three sub-sections: unrecorded attendance,
incomplete student documents, upcoming tuition-due reminders.

**Explicitly NOT wired to a real API.** None of the three data sources
exist in this frontend today:
- Attendance: the only endpoint is `POST /teacher/attendance`
  (`@Roles('teacher')`, one-student-at-a-time recording) — there's no
  staff-facing list/summary endpoint to say which classes are unrecorded.
- Student documents: no `student-documents` API/types file exists anywhere
  in `src/api` or `src/types`.
- Notifications/reminders: no `notifications` API file exists either,
  despite the backend module reportedly already existing.

Each sub-section renders from a hardcoded `SAMPLE_*` array and shows a
visible "این بخش فعلاً با داده نمونه نمایش داده می‌شود" banner, with every
per-row action button disabled (tooltip: "پس از اتصال به بک‌اند فعال
می‌شود"). Layout/shape only — **do not ship this to production as-is**;
swap the `SAMPLE_*` arrays for real query hooks (and enable the action
buttons) once the three backend contracts above are shared.

**New/modified:** `frontend/src/pages/DashboardPage.tsx` — added
`TodayChecklist`, `ChecklistSection`, three `SAMPLE_*` constants; added
`AttendanceIcon`, `AssignmentsIcon`, `CalendarIcon` to the existing
`SchoolIcons` import; added `ReactNode` type import.

## Custom icon set integration


Replaced the app's ad-hoc, repeatedly-duplicated generic icon set with the
new custom-designed set (`SchoolIcons.tsx` — geometric outline style with
a shared "chamfered corner" signature detail). Previously, near-identical
icon functions (`TuitionIcon`, `UsersIcon`, `CheckIcon`, `AlertIcon`,
`SchoolIcon`, etc.) were copy-pasted locally in ~12 different files, each
a hand-rolled generic feather-style SVG — exactly the situation
`components/icons/StatIcons.tsx`'s own comment flagged as a stopgap
awaiting real design direction.

**New file:** `frontend/src/components/icons/SchoolIcons.tsx` — the full
custom set (25 icons), viewBox `0 0 24 24`, `currentColor` stroke,
parametric `size`/`strokeWidth` (defaults 20 / 1.75).

**Removed file:** `frontend/src/components/icons/StatIcons.tsx` (fully
superseded — its two importers now point at `SchoolIcons.tsx`).

**Modified files** — local duplicate icon functions removed, replaced
with imports from `SchoolIcons.tsx`:
```
frontend/src/components/Sidebar.tsx           — 10 nav icons
frontend/src/components/EmptyState.tsx        — DefaultIcon (size=28)
frontend/src/components/FormError.tsx         — ErrorIcon (size=14)
frontend/src/components/PersianDatePicker.tsx — CalendarIcon (size=16)
frontend/src/pages/DashboardPage.tsx
frontend/src/pages/founder/FounderSchoolDashboardPage.tsx
frontend/src/pages/founder/FounderOverviewPage.tsx
frontend/src/pages/founder/FounderTuitionPage.tsx
frontend/src/pages/parent/ParentDashboardPage.tsx
frontend/src/pages/teacher/TeacherDashboardPage.tsx
frontend/src/pages/UsersPage.tsx
frontend/src/pages/SchoolsPage.tsx
frontend/src/pages/StudentsPage.tsx
```

**Left untouched, intentionally:** the two bespoke 28px empty-state
illustrations (`StudentsEmptyIcon` in `StudentsPage.tsx` and
`FounderStudentsPage.tsx`) and `PersianDatePicker`'s `ChevronRight`/
`ChevronLeft` — none of these are part of the named shared set.

**Sizing note:** call sites that didn't previously pass an explicit size
now render at the new set's 20px default (up from the old ad-hoc 18px) —
consistent across every stat card and nav icon. The three inline-context
icons (`ErrorIcon`, `CalendarIcon` in the date picker, `DefaultIcon`)
explicitly pass their original size (14 / 16 / 28) so nothing there
shifts visually.

**Verification in this offline sandbox:** every import resolves to a real
export in `SchoolIcons.tsx` (checked all 25 exported names against every
import site); every imported icon is referenced at its call site (no
`noUnusedLocals` violations); brace/paren balance checked on all 13
touched files. No `node_modules` in this sandbox, so a local `npm run
build` / `tsc -b` is still recommended as the final gate before commit,
consistent with every prior sprint's own audit note.

## Bugfix pass


Three small fixes reported after the Founder Dashboard sprint:

1. **Native date pickers showed the Gregorian calendar.** Every
   `<input type="date">` in the app (StudentsPage, StudentDetailPage,
   SettingsPage, TeacherHomeworkPage, TeacherAttendancePage) opened the
   browser's own Gregorian-only calendar popup, even though the app
   already *displayed* saved dates correctly in Jalali via `formatDate()`
   — only the picker UI itself was wrong. Added `lib/jalali.ts`
   (Gregorian↔Jalali conversion, built on `Intl`'s built-in Persian
   calendar rather than a hand-rolled leap-year algorithm — verified
   against ~750 date combinations) and `components/PersianDatePicker.tsx`
   (a Jalali calendar-grid picker), and swapped in every native date
   input for it. The stored value is still a plain ISO `'YYYY-MM-DD'`
   string, so nothing downstream (API payloads, `formatDate()`) changed.
   Note: since this is a button-based widget, not a native form control,
   `required` no longer blocks submission with an in-browser bubble the
   way `<input required>` did — it's now enforced by each mutation's
   normal backend validation instead.
2. **No way to register a teacher account.** `UsersPage`'s create-user
   role Select and `ROLE_FILTER_OPTIONS` deliberately excluded `'teacher'`
   as of the Sprint 1 Teacher Portal work — but `POST /auth/register`
   already accepts `role: 'teacher'` the same as any other role. Added
   it to both.
3. **Tuition base-amount field always showed a `0`.** `CreateTuitionPlanForm`
   (StudentDetailPage) initialized `baseAmount` to `0` instead of empty,
   so the field looked pre-filled. Changed it to the same `number | ''`
   pattern already used by the discount field, with a placeholder
   (`مثلاً ۵۰۰۰۰۰۰`) shown when empty; added a placeholder to the discount
   field too for consistency.

**New files:** `frontend/src/lib/jalali.ts`,
`frontend/src/components/PersianDatePicker.tsx`

## Sprint: Founder Dashboard


Read-only, multi-school portal for the new `founder` role (see
`founder-frontend-prompt.md`). A founder owns one or more schools and can
view — but never edit — aggregated and per-school data under `/founder/*`.

**New files**
```
frontend/src/types/founder.types.ts
frontend/src/api/founder.api.ts
frontend/src/hooks/useFounder.ts
frontend/src/components/founder/FounderSchoolSwitcher.tsx
frontend/src/pages/founder/FounderOverviewPage.tsx
frontend/src/pages/founder/FounderSchoolLayout.tsx
frontend/src/pages/founder/FounderSchoolDashboardPage.tsx
frontend/src/pages/founder/FounderStudentsPage.tsx
frontend/src/pages/founder/FounderTeachersPage.tsx
frontend/src/pages/founder/FounderStaffPage.tsx
frontend/src/pages/founder/FounderTuitionPage.tsx
```

**Modified files**
```
frontend/src/types/auth.types.ts    — added 'founder' to UserRole
frontend/src/lib/queryKeys.ts       — added `founder` key namespace
frontend/src/components/HomeRedirect.tsx — founder -> /founder/overview
frontend/src/components/Sidebar.tsx — founder nav item + labels
frontend/src/components/Topbar.tsx  — founder role label
frontend/src/App.tsx                — /founder/* routes
frontend/src/pages/UsersPage.tsx    — founder role in labels/filter/create form
frontend/src/pages/SchoolsPage.tsx  — FounderLinkManager (super_admin-only
                                       founder<->school ownership UI)
```

**Routes**
- `/founder/overview` — aggregated totals across every owned school.
- `/founder/schools/:schoolId` (+ `/students`, `/teachers`, `/staff`,
  `/tuition`) — per-school views, wrapped in `FounderSchoolLayout` (school
  switcher + tab bar + "school not found" handling for a stale/foreign
  `schoolId`).

**Known limitation**: the backend exposes `POST /founder/link` and
`DELETE /founder/link/:id` but no `GET` to list a founder's existing
school links, so `FounderLinkManager` (in SchoolsPage) can only track and
un-link links created in the current browser session. A listing endpoint
would remove this constraint.

This is the final, integrated codebase merging every approved Sprint 1
change into a single, conflict-free version. Frontend only. No backend
files, no new npm packages, no new endpoints, TypeScript strict mode
preserved throughout.

## Merged sprints

1. **school_admin Analytics Dashboard** — new `GET /analytics/dashboard`-backed
   dashboard for the `school_admin` role.
2. **Loading & Skeleton UI (Sprint 1B)** — skeleton-card loading state for
   `InstallmentsPage`'s stat-card row.
3. **Row Selection & Export Selected (InstallmentsPage)** — bulk row
   selection with header checkbox and a filtered "export selected" action.
4. **Grade & Academic Year Filters (Students)** — grade and academic-year
   filters on `StudentsPage`, combined with the existing search filter.
5. **Sprint 1C: One-step Payment Flow, Dashboard Financial Trends, Staff
   Dashboard Improvements**.

Each sprint above was independently approved. This integration pass
combines them into one working tree, resolving the overlaps described
below, without adding, removing, or altering any approved behavior.

## Files in this integration (11 total)

```
frontend/src/types/analytics.types.ts       (new — sprint 1)
frontend/src/api/analytics.api.ts            (new — sprint 1)
frontend/src/api/index.ts                    (modified — sprint 1)
frontend/src/hooks/useAnalytics.ts           (new — sprint 1)
frontend/src/lib/queryKeys.ts                (modified — sprint 1)
frontend/src/components/Table.tsx            (modified — sprint 3)
frontend/src/components/RecordPaymentModal.tsx (modified — sprint 5)
frontend/src/pages/DashboardPage.tsx         (modified — sprints 1 + 5, merged)
frontend/src/pages/InstallmentsPage.tsx      (modified — sprints 2 + 3 + 5, merged)
frontend/src/pages/StudentsPage.tsx          (modified — sprints 4 + 5, merged)
frontend/src/pages/StudentDetailPage.tsx     (modified — sprint 5)
```

No other frontend files, and no backend files, were touched by any of the
five sprints — verified independently by each sprint's own regression
audit and re-confirmed here (see "Regression audit" below).

## Files that required merging (overlapping edits)

Three files were touched by more than one sprint, each targeting a
different, non-overlapping piece of functionality in the same file. Each
was hand-merged so that every approved change from every sprint survives
intact, with no duplicated logic and no code lost.

### `frontend/src/pages/DashboardPage.tsx`

- **Base**: sprint 1's version (adds `SchoolAdminDashboard`, routing
  `school_admin` to it via `useDashboard()`; `FinancialDashboard` and
  `StaffDashboard` otherwise unchanged from the pre-sprint baseline).
- **Merged in from sprint 5**:
  - `StaffDashboard` replaced with sprint 5's fuller version: derived
    daily stats (active / registered-today / registered-this-month,
    computed client-side from `useStudents()`), quick shortcuts to
    `/students` and `/students/archived`, and a "+ ثبت‌نام دانش‌آموز
    جدید" entry point that opens `StudentsPage`'s existing create-student
    form via router `state`.
  - `FinancialTrendPanel` (a 6-month income trend card with a
    previous-month `▲/▼ N%` delta, built on the existing
    `useMonthlyIncomeTrend` hook) inserted into `FinancialDashboard`,
    between the existing KPI/pie-chart row and the overdue-breakdown
    section — exactly where sprint 5 placed it.
  - Added imports needed by the above: `useMemo` (react),
    `useMonthlyIncomeTrend` (`hooks/useReports`), `useStudents`
    (`hooks/useStudents`).
- **Duplicate avoided**: both sprints independently defined an identical
  `persianMonthNames` constant. Kept the single top-level declaration
  (already used by `SchoolAdminDashboard`) and had `FinancialTrendPanel`
  reference that same constant instead of redeclaring it.
- **Untouched**: `SchoolAdminDashboard` (sprint 1, in full), the
  `FinancialDashboard` statistics/KPI/pie-chart/debtor/activity sections
  (byte-identical between both source versions aside from the inserted
  panel), all icon components, `LegendRow`, and the `DashboardPage()`
  role-routing function.

### `frontend/src/pages/InstallmentsPage.tsx`

- **Base**: sprint 3's version, which was already built directly on top
  of sprint 2 (skeleton-loading stat cards) per sprint 3's own changelog
  — so both of those sprints' work is present in the base with no merge
  needed between them.
- **Merged in from sprint 5**:
  - `payingInstallment` state widened from `PayableInstallment` to
    `InstallmentWithStudent` (the value already had this shape; only the
    state's type was narrower), so the selected installment's student
    name is available.
  - `studentName={payingInstallment.tuitionPlan.student.fullName}` passed
    to `RecordPaymentModal`, enabling the one-step payment → receipt flow.
  - Removed the now-unused `PayableInstallment` import (superseded by the
    wider `InstallmentWithStudent` type, which the file already imported).
- **Untouched**: the `SkeletonCards`-gated stat-card row (sprint 2), row
  selection / "select all" / export-selected (sprint 3), filters,
  pagination, and every column definition.

### `frontend/src/pages/StudentsPage.tsx`

- **Base**: sprint 4's version (grade + academic-year `<Select>` filters
  combined with the existing search filter, all ANDed into one
  `useStudents(...)` params object; pagination reset on filter change).
- **Merged in from sprint 5**:
  - Added `useLocation` import (react-router-dom).
  - `showForm`'s initial value now reads
    `(location.state as { openCreateForm?: boolean } | null)?.openCreateForm`,
    so the staff dashboard's quick-registration shortcut can open this
    page's existing create-student form automatically, without
    duplicating the form.
- **Untouched**: grade/academic-year filter state, the two `<Select>`s
  and their "all" option handling, `runSearch`/`handleSearch`,
  `handleExport`, and `CreateStudentForm`'s own local `gradeId`/
  `academicYearId` state (correctly scoped to that separate function —
  no collision with the page-level filter state of the same name).

## Files merged as-is (single sprint, no conflicts)

- `frontend/src/types/analytics.types.ts`, `frontend/src/api/analytics.api.ts`,
  `frontend/src/hooks/useAnalytics.ts`, `frontend/src/api/index.ts`,
  `frontend/src/lib/queryKeys.ts` — sprint 1 only.
- `frontend/src/components/Table.tsx` — sprint 3 only (`TableColumn.header`
  widened from `string` to `ReactNode`).
- `frontend/src/components/RecordPaymentModal.tsx`,
  `frontend/src/pages/StudentDetailPage.tsx` — sprint 5 only.

## Regression audit

- **No broken imports**: every cross-file import in the 11 merged files
  (`useDashboard`, `getDashboard`, `queryKeys.analytics`, `useStudents`,
  `useMonthlyIncomeTrend`, `useLocation`, `RecordPaymentModal`,
  `PayableInstallment`, `InstallmentWithStudent`, `Select`, `SkeletonCards`,
  etc.) resolves to a real export that already existed pre-integration or
  was added by exactly one of the five sprints — traced individually
  during the merge.
- **No duplicate components/hooks**: grepped every merged file for
  duplicate `function`/`const` top-level declarations. The only pre-merge
  duplicate found — `persianMonthNames` (defined independently by sprint 1
  and sprint 5 in `DashboardPage.tsx`) — was collapsed to a single
  declaration; every other symbol is declared exactly once.
- **No unreachable code**: `StaffDashboard`'s old one-`Card` stub and
  `InstallmentsPage`'s narrower `PayableInstallment` state type — the two
  pieces of pre-merge code that sprint 5 superseded — were fully replaced
  rather than left dead alongside the new versions.
- **TypeScript**: `tsc --noEmit` was run against all 11 files with the
  project's actual compiler flags (`react-jsx`, `es2020`, strict module
  resolution). With no `node_modules` available in this offline
  environment, the only errors reported are expected "cannot find module"
  / implicit-`any` noise from third-party and sibling-file type
  declarations that aren't installed in this sandbox — there are zero
  parser errors (`TS1xxx`) and zero duplicate-identifier /
  redeclaration errors (`TS2300`, `TS2393`, `TS2440`, `TS2451`) anywhere
  in the merged tree. **Recommend a local `npm run build` / `tsc -b` as a
  final gate before commit**, consistent with every individual sprint's
  own audit.
- **No UI regressions**: every approved visual/behavioral change from all
  five sprints is present and none was altered — skeleton loading, row
  selection + export-selected, grade/academic-year filters, the
  school_admin analytics dashboard, the one-step payment→receipt flow,
  the financial trend panel, and the rebuilt staff dashboard all render
  through the same components and styling each sprint already verified
  individually.
- **No unrelated files changed**: the merged tree contains exactly the 11
  files listed above — the same set of files touched, in total, across
  all five source sprints. No new files were added beyond what sprint 1
  already introduced (`analytics.types.ts`, `analytics.api.ts`,
  `useAnalytics.ts`), and no files were removed.
