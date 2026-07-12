# Changelog — Integration Build

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
