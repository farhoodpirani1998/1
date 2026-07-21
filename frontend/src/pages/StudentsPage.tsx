import { useEffect, useMemo, useRef, useState, FormEvent, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card } from '../components/Card';
import { SearchInput } from '../components/SearchInput';
import { Select } from '../components/Select';
import { FilterBar } from '../components/FilterBar';
import { Table, type TableColumn } from '../components/Table';
import { Pagination } from '../components/Pagination';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { PersianDatePicker } from '../components/PersianDatePicker';
import { SkeletonCards } from '../components/Skeleton';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from '../components/FormError';
import { exportToExcel } from '../lib/exportExcel';
import { fetchAllPages } from '../lib/fetchAllPages';
import { getStudentsPaginated } from '../api/students.api';
import type { Student, Grade, AcademicYear } from '../types/student.types';
import {
  useStudents,
  useStudentsPaginated,
  useCreateStudent,
  useGrades,
  useAcademicYears,
  useClasses,
} from '../hooks/useStudents';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../lib/auth';
import { UsersIcon, CheckIcon, AlertIcon, CalendarIcon, ChevronEnterIcon } from '../components/icons/SchoolIcons';
import { BulkImportStudentsPanel } from '../components/BulkImportStudentsPanel';
import { StudentProfileModal } from '../components/StudentProfileModal';
import { EmptyState } from '../components/EmptyState';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { DensityToggle } from '../components/DensityToggle';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const statusLabels: Record<Student['status'], string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

// Presentation-only badge for a student's status — kept local to this page
// rather than reusing the shared <StatusBadge/>, which is typed strictly
// for InstallmentStatus (paid/pending/overdue/...) and doesn't cover
// active/withdrawn/graduated. Same visual language (.badge class, status
// color tokens) as the shared component, just for a different domain type.
const statusBadgeClass: Record<Student['status'], string> = {
  active: 'bg-paid/10 text-paid border-paid/25',
  withdrawn: 'bg-overdue/10 text-overdue border-overdue/25',
  graduated: 'bg-action-soft text-action border-action/25',
};

function StudentStatusBadge({ status }: { status: Student['status'] }) {
  return (
    <span className={`badge ${statusBadgeClass[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

// Simple initial-letter avatar placeholder — purely presentational, derived
// from the student's existing fullName (no new/fake data).
function StudentAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action-soft text-sm font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

export function StudentsPage() {
  // GET /students/:id/profile is school_admin/accountant only (it embeds
  // the tuition/payment summary) — staff can browse this page but never
  // sees the "پروفایل" action, same "staff can see the student record
  // but not the financial summary" gate the backend documents on that
  // route.
  const { user } = useAuth();
  const canViewProfile = user?.role === 'school_admin' || user?.role === 'accountant';
  const { showSuccess, showError } = useToast();
  const location = useLocation();
  // The staff dashboard's "quick registration" shortcut links here with
  // this flag (see DashboardPage.tsx#StaffDashboard) instead of
  // duplicating the create-student form on another page — it just opens
  // the same form CreateStudentForm/useCreateStudent already power below.
  const [showForm, setShowForm] = useState(
    () => Boolean((location.state as { openCreateForm?: boolean } | null)?.openCreateForm),
  );
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [search, setSearch] = useState('');
  // Search is live-as-you-type, debounced by SEARCH_DEBOUNCE_MS so it
  // doesn't refetch on every keystroke. `debouncedSearch` is the value
  // actually sent to the API / used in the query key; `search` above is
  // just the input's live text.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [gradeId, setGradeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  // Sprint 3.1 — toolbar shell only for status. Status is a visual
  // placeholder with no filtering logic yet (see original Sprint 3.1
  // notes); class *did* have this same placeholder note, but now has a
  // real backing field (Student.classId) and a real filter below.
  const [statusFilterDisplay, setStatusFilterDisplay] = useState('');
  const [page, setPage] = useState(1);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);
  const [exporting, setExporting] = useState(false);
  // Sprint 3.3 — row selection / bulk action bar. Same Set<string>-of-ids
  // pattern already used by InstallmentsPage's selection column, kept
  // local to this page's UI state — it doesn't touch the query, filters,
  // or pagination in any way. Like InstallmentsPage, selection persists
  // across page/filter changes on purpose (a paginated "select all"
  // scope is per-page only — see `pageSelectedCount` below — but ids the
  // user already checked on another page stay checked if they navigate
  // back), and is only ever cleared explicitly via "لغو انتخاب" or by
  // checking a row/select-all off.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // پروفایل دانش‌آموز — opened via the "پروفایل" row action below; shared
  // modal, same component TeacherAssessmentsPage/TeacherStudentsPage use.
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  // Sprint A2.1 — Workspace Toolbar "View controls". Purely presentational:
  // Table already supports a `density` prop ('compact' | 'comfortable',
  // hardcoded to 'comfortable' below before this sprint) — this just lets
  // the admin switch it instead of it being fixed. No query, filter,
  // pagination, or column change of any kind.
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');

  const filterParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(gradeId ? { gradeId } : {}),
    ...(classId ? { classId } : {}),
    ...(academicYearId ? { academicYearId } : {}),
  };

  // Phase 4B: real server-side pagination — the table only ever holds
  // one page (PAGE_SIZE rows) in memory, and `total` below is the true
  // filtered count from the backend, not capped at MAX_PAGE_LIMIT (200).
  const studentsQuery = useStudentsPaginated(page, PAGE_SIZE, filterParams);
  // Cheap accurate active/inactive counts: same filters, limit=1 — the
  // backend still runs COUNT(*) over the full matching set (getManyAndCount),
  // so `total` is correct however many students that is, without fetching
  // their rows. See StudentsService.findWithFilters.
  const activeCountQuery = useStudentsPaginated(1, 1, { ...filterParams, status: 'active' });
  const gradesQuery = useGrades();
  const academicYearsQuery = useAcademicYears();
  const createStudent = useCreateStudent();

  // "New this month" (enrollmentDate in the current calendar month) has
  // no matching backend filter yet, so it's kept on the old bounded
  // getStudents() call (capped at 200, same as before this fix) rather
  // than adding a new date-range endpoint param — a pre-existing,
  // smaller limitation on this one stat card, not the list-truncation
  // bug this change addresses.
  const statsRosterQuery = useStudents(filterParams);

  const pageItems = studentsQuery.data?.data ?? [];
  const totalCount = studentsQuery.data?.total ?? 0;
  const grades = gradesQuery.data ?? [];
  const academicYears = academicYearsQuery.data ?? [];
  const loading = studentsQuery.isLoading;

  // Class filter options: scoped to whichever grade/year the admin has
  // already picked; if no year is picked yet, fall back to the current
  // year (classes are always scoped to one academicYearId — see
  // Class entity on the backend — so "همه‌ی کلاس‌ها" across every year at
  // once isn't a query the backend supports, and isn't a distinction
  // most admins care about day-to-day anyway).
  const currentAcademicYearId = academicYears.find((y) => y.isCurrent)?.id;
  const classesQuery = useClasses({
    ...(gradeId ? { gradeId } : {}),
    academicYearId: academicYearId || currentAcademicYearId,
  });
  const classesForFilter = classesQuery.data ?? [];


  // Sprint 3.3 — selection state derived from the current page + selectedIds.
  // "Select all" only ever acts on the rows currently on screen (matches
  // the InstallmentsPage precedent) — it never reaches across pages, so
  // pagination/query logic stays untouched.
  const pageSelectedCount = pageItems.filter((s) => selectedIds.has(s.id)).length;
  const allPageSelected = pageItems.length > 0 && pageSelectedCount === pageItems.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageItems.forEach((s) => next.delete(s.id));
      } else {
        pageItems.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Reset to page 1 whenever any filter narrows/widens the result set —
  // search (debounced), grade, or academic year — so pagination can't be
  // left pointing at a page that no longer exists under the new results.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, gradeId, classId, academicYearId]);

  async function handleExport() {
    setExporting(true);
    try {
      const allStudents = await fetchAllPages((p, l) =>
        getStudentsPaginated(p, l, filterParams).then((res) => res.data),
      );
      exportToExcel(
        'دانش‌آموزان',
        'دانش‌آموزان',
        allStudents.map((s) => ({
          نام: s.fullName,
          پایه: s.grade?.title ?? '',
          کلاس: s.class?.title ?? '',
          والد: s.guardian?.fullName ?? '',
          'تلفن والد': s.guardian?.phone ?? '',
          وضعیت: statusLabels[s.status],
        })),
      );
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  // Distinguishes "the roster is genuinely empty" (show an inviting
  // add-student CTA) from "a search/filter just happens to match nothing"
  // (show a plain no-results message instead).
  const isFiltered = Boolean(debouncedSearch || gradeId || classId || academicYearId);

  // Sprint A2.2 — single source of truth for "grade changed" (a class from
  // the previous grade no longer applies), extracted from the Select's
  // inline onChange below so the filter chips' "×" can call the exact same
  // logic instead of duplicating it. No new filtering behavior — same two
  // setState calls that already existed.
  function handleGradeChange(value: string) {
    setGradeId(value);
    setClassId('');
  }

  // Sprint A2.2 — same reset already used by the table's "پاک کردن فیلترها"
  // empty-state action, pulled out so the new filter-chips row can reuse it
  // verbatim (task 1 requires reusing existing filter state, not new logic).
  function clearAllFilters() {
    setSearch('');
    setGradeId('');
    setAcademicYearId('');
    setClassId('');
    // Visual-only placeholder from Sprint 3.1 — reset for consistency even
    // though it doesn't drive the query.
    setStatusFilterDisplay('');
  }

  // Sprint A2.2 — compact filter chips (task 1). Purely derived from
  // existing filter state + the option lists already fetched for the
  // Selects above; no new query, no new filtering logic. Only real,
  // query-affecting filters get a chip — the still-unwired "status"
  // placeholder (see Sprint 3.1 notes on statusFilterDisplay) is
  // intentionally excluded so a chip never claims to filter something it
  // doesn't.
  const activeFilterChips: { key: string; label: string; onClear: () => void }[] = [];
  if (debouncedSearch) {
    activeFilterChips.push({ key: 'search', label: `جستجو: «${debouncedSearch}»`, onClear: () => setSearch('') });
  }
  if (gradeId) {
    const grade = grades.find((g) => g.id === gradeId);
    activeFilterChips.push({
      key: 'grade',
      label: `پایه: ${grade?.title ?? '—'}`,
      onClear: () => handleGradeChange(''),
    });
  }
  if (classId) {
    const cls = classesForFilter.find((c) => c.id === classId);
    activeFilterChips.push({ key: 'class', label: `کلاس: ${cls?.title ?? '—'}`, onClear: () => setClassId('') });
  }
  if (academicYearId) {
    const year = academicYears.find((y) => y.id === academicYearId);
    activeFilterChips.push({
      key: 'year',
      label: `سال تحصیلی: ${year?.title ?? '—'}`,
      onClear: () => setAcademicYearId(''),
    });
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // Sprint 3.2 — presentational only, for the "نمایش X–Y از Z" pagination
  // summary. Derived entirely from state already in scope; no new query.
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const activeCount = activeCountQuery.data?.total ?? 0;
  const inactiveCount = Math.max(0, totalCount - activeCount);
  const statsRoster = statsRosterQuery.data ?? [];
  const newThisMonthCount = useMemo(() => {
    const now = new Date();
    return statsRoster.filter((s) => {
      if (!s.enrollmentDate) return false;
      const d = new Date(s.enrollmentDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [statsRoster]);

  const columns: TableColumn<Student>[] = [
    {
      key: 'select',
      header: (
        <SelectionCheckbox
          checked={allPageSelected}
          indeterminate={somePageSelected}
          onChange={toggleSelectAllOnPage}
          ariaLabel="انتخاب همه‌ی دانش‌آموزان این صفحه"
        />
      ),
      align: 'center',
      headerClassName: 'w-10',
      cellClassName: 'w-10',
      render: (s) => (
        <SelectionCheckbox
          checked={selectedIds.has(s.id)}
          onChange={() => toggleSelectRow(s.id)}
          ariaLabel={`انتخاب ${s.fullName}`}
        />
      ),
    },
    {
      key: 'name',
      header: 'نام',
      cellClassName: 'min-w-[11rem]',
      render: (s) => (
        <div className="flex items-center gap-3">
          <StudentAvatar name={s.fullName} />
          <span className="font-medium text-ink dark:text-paper">{s.fullName}</span>
        </div>
      ),
    },
    {
      key: 'grade',
      header: 'پایه',
      cellClassName: 'text-ink/70 dark:text-paper/70',
      render: (s) => s.grade?.title ?? '—',
    },
    {
      key: 'class',
      header: 'کلاس',
      cellClassName: 'text-ink/70 dark:text-paper/70',
      render: (s) => s.class?.title ?? '—',
    },
    {
      key: 'guardian',
      header: 'والد',
      // Sprint 3.2 — hidden below sm to reduce horizontal cramping on small
      // screens (task 5); the data itself is unchanged and still reachable
      // from the student's own statement page via the actions link.
      headerClassName: 'hidden sm:table-cell',
      cellClassName: 'hidden sm:table-cell text-ink/70 dark:text-paper/70',
      render: (s) => s.guardian?.fullName ?? '—',
    },
    {
      key: 'status',
      header: 'وضعیت',
      align: 'center',
      headerClassName: 'text-center',
      render: (s) => <StudentStatusBadge status={s.status} />,
    },
    {
      key: 'actions',
      // Sprint A2.2 (task 4) — the visible header stays blank (an "عملیات"
      // label above right-aligned row actions is redundant for sighted
      // users and every other table in the app leaves this column
      // unlabeled too), but a sr-only label means the column still
      // announces something meaningful to screen readers instead of an
      // empty header cell. Row actions/behavior below are untouched.
      header: <span className="sr-only">عملیات</span>,
      align: 'left',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {canViewProfile && (
            <button
              type="button"
              onClick={() => setProfileStudentId(s.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-sm font-medium text-ink/60 transition-colors hover:border-line hover:bg-paper dark:text-paper/60 dark:hover:bg-white/5"
            >
              پروفایل
            </button>
          )}
          <Link
            to={`/students/${s.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-sm font-medium text-action transition-colors hover:border-action/25 hover:bg-action-soft dark:hover:bg-action/10"
          >
            صورت‌حساب
            <ChevronEnterIcon size={14} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in">
      {/* Sprint A2.1 (Student Workspace) — structured page header, now via
          the shared <WorkspaceHeader/> (extracted in Sprint A3.1 so the
          Teacher Workspace can reuse the identical markup). Live count
          badge uses the same totalCount already fetched for the stat
          cards below — no new query. "غیرفعال‌ها" stays here as the
          secondary action (a page-level navigation shortcut, not a
          workspace/filtering action). */}
      <WorkspaceHeader
        title="دانش‌آموزان"
        subtitle="مدیریت اطلاعات، وضعیت ثبت‌نام و صورت‌حساب دانش‌آموزان"
        countLabel={loading ? '…' : `${toPersianCount(totalCount)} دانش‌آموز`}
        countIcon={<UsersIcon size={12} />}
        countAriaLabel="تعداد کل دانش‌آموزان"
        secondaryActions={
          <Link to="/students/archived" className="btn-secondary">
            غیرفعال‌ها
          </Link>
        }
        primaryAction={
          <Button
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => {
              setShowForm((v) => !v);
              setShowBulkImport(false);
            }}
          >
            {showForm ? 'انصراف' : '+ دانش‌آموز جدید'}
          </Button>
        }
      />

      {loading ? (
        <div className="mb-2">
          <SkeletonCards count={4} />
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="کل دانش‌آموزان" value={toPersianCount(totalCount)} icon={<UsersIcon />} />
          <StatCard
            label="دانش‌آموزان فعال"
            value={toPersianCount(activeCount)}
            accent="paid"
            icon={<CheckIcon />}
          />
          <StatCard
            label="دانش‌آموزان غیرفعال"
            value={toPersianCount(inactiveCount)}
            accent="overdue"
            icon={<AlertIcon />}
          />
          <StatCard
            label="ثبت‌نام جدید این ماه"
            value={toPersianCount(newThisMonthCount)}
            accent="action"
            icon={<CalendarIcon />}
          />
        </div>
      )}

      {showForm && (
        <CreateStudentForm
          grades={grades}
          academicYears={academicYears}
          saving={createStudent.isPending}
          error={createError}
          onSubmit={(dto) => {
            setCreateError(null);
            createStudent.mutate(dto, {
              onSuccess: () => {
                setShowForm(false);
                showSuccess('دانش‌آموز ثبت شد');
              },
              onError: (err) => {
                setCreateError(parseApiError(err));
                showError(getErrorMessage(err));
              },
            });
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportStudentsPanel grades={grades} academicYears={academicYears} onClose={() => setShowBulkImport(false)} />
      )}

      <Card className="mt-6">
        {/* Sprint 3.1 — toolbar shell. Bottom border + margin separates it
            from the table as its own zone (visual hierarchy). Search,
            grade and academic-year keep their exact pre-existing state/
            handlers and still drive the real query below; Status, Class
            and "More filters" are new, visual-only placeholders per the
            Sprint 3.1 spec (no filtering logic attached — see task 2). */}
        <div className="mb-4 flex flex-col border-b border-line pb-4 dark:border-white/10">
          <FilterBar
            actions={
              <>
                {/* View controls — toggles the exact 'compact' |
                    'comfortable' values Table's own `density` prop already
                    accepted (see the `density` state above and the Table
                    call below). Sprint A3.1 extracted this into the shared
                    <DensityToggle/> so the Teacher Workspace's toolbar
                    reuses the identical control. */}
                <DensityToggle value={density} onChange={setDensity} />

                <span className="hidden h-6 w-px bg-line dark:bg-white/10 sm:inline-block" aria-hidden="true" />

                {/* Data actions — same handlers as before, just grouped
                    together separately from the view controls above. */}
                <Button variant="secondary" leftIcon={<ImportIcon />} onClick={() => { setShowBulkImport((v) => !v); setShowForm(false); }}>
                  ورودی اکسل
                </Button>
                <Button variant="secondary" leftIcon={<ExportIcon />} onClick={handleExport} loading={exporting}>
                  خروجی اکسل
                </Button>
                {/* Sprint 3.1 — visual only. Wiring this to studentsQuery /
                    activeCountQuery / gradesQuery / academicYearsQuery
                    refetch is a one-line change but is deliberately left
                    for a future sprint so this stays UI-shell-only. */}
                <Button variant="ghost" leftIcon={<RefreshIcon />} aria-label="بروزرسانی فهرست">
                  بروزرسانی
                </Button>
              </>
            }
          >
            <SearchInput
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="جستجو با نام..."
              containerClassName="w-full sm:w-60"
            />

            <span className="hidden h-6 w-px bg-line dark:bg-white/10 sm:inline-block" aria-hidden="true" />

            <Select
              value={gradeId}
              onChange={(e) => handleGradeChange(e.target.value)}
              options={[{ value: '', label: 'همه‌ی پایه‌ها' }, ...grades.map((g) => ({ value: g.id, label: g.title }))]}
              containerClassName="w-auto"
              aria-label="فیلتر پایه تحصیلی"
            />
            <Select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              options={[
                { value: '', label: 'همه‌ی سال‌های تحصیلی' },
                ...academicYears.map((y) => ({
                  value: y.id,
                  label: `${y.title}${y.isCurrent ? ' (جاری)' : ''}`,
                })),
              ]}
              containerClassName="w-auto"
              aria-label="فیلتر سال تحصیلی"
            />
            {/* Sprint 3.1 — visual-only placeholder. Not part of
                filterParams; selecting a value does not change the table. */}
            <Select
              value={statusFilterDisplay}
              onChange={(e) => setStatusFilterDisplay(e.target.value)}
              options={[
                { value: '', label: 'همه‌ی وضعیت‌ها' },
                { value: 'active', label: 'فعال' },
                { value: 'withdrawn', label: 'انصرافی' },
                { value: 'graduated', label: 'فارغ‌التحصیل' },
              ]}
              containerClassName="w-auto"
              aria-label="فیلتر وضعیت (به‌زودی)"
            />
            {/* Real filter, wired to Student.classId — see
                classesForFilter above for how the option list is scoped. */}
            <Select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              options={[
                { value: '', label: 'همه‌ی کلاس‌ها' },
                ...classesForFilter.map((c) => ({ value: c.id, label: c.title })),
              ]}
              containerClassName="w-auto"
              aria-label="فیلتر کلاس"
            />
            <Button variant="ghost" leftIcon={<MoreFiltersIcon />}>
              فیلترهای بیشتر
            </Button>
          </FilterBar>

          {/* Sprint A2.2 — active filter chips (task 1). Shown only when at
              least one real filter is applied; each chip reflects existing
              filter state and its "×" reuses the exact same setters as the
              Selects/SearchInput above (or the shared handleGradeChange /
              clearAllFilters helpers) — no new filtering logic is
              introduced anywhere in this block. */}
          {activeFilterChips.length > 0 && (
            <div
              role="group"
              aria-label="فیلترهای فعال"
              className="fade-in mt-3 flex flex-wrap items-center gap-2"
            >
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="badge border-action/25 bg-action-soft py-1 pl-1.5 text-action dark:border-action/30 dark:bg-action/10 dark:text-action-light"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.onClear}
                    aria-label={`حذف فیلتر ${chip.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-action/70 transition-colors hover:bg-action/15 hover:text-action dark:text-action-light/70 dark:hover:bg-action-light/15 dark:hover:text-action-light"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </span>
              ))}
              {activeFilterChips.length > 1 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-md px-2 py-1 text-xs font-medium text-ink/50 transition-colors hover:bg-paper hover:text-ink dark:text-paper/50 dark:hover:bg-white/10 dark:hover:text-paper"
                >
                  پاک کردن همه
                </button>
              )}
            </div>
          )}

          {/* Sprint 3.3 — bulk action bar, shown only once at least one row
              is selected. Content/handlers unchanged from before this
              sprint (reused verbatim, per task 2); now nested inside the
              same toolbar shell as the search/filter/actions row above
              instead of sitting outside it, so it reads as this toolbar's
              fourth section rather than a separate floating strip. */}
          {selectedIds.size > 0 && (
            <div
              role="region"
              aria-label="نوار عملیات گروهی"
              className="fade-in mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-action/25 bg-action-soft px-4 py-2.5 dark:border-action/30 dark:bg-action/10"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-action dark:text-action-light" aria-live="polite">
                  {toPersianCount(selectedIds.size)} مورد انتخاب شده
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/60 transition-colors hover:bg-white/60 hover:text-ink dark:text-paper/60 dark:hover:bg-white/10 dark:hover:text-paper"
                >
                  <ClearSelectionIcon />
                  لغو انتخاب
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ExportIcon />}
                  disabled
                  title="پس از اتصال به بک‌اند فعال می‌شود"
                >
                  خروجی انتخاب‌شده‌ها
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ArchiveIcon />}
                  disabled
                  title="پس از اتصال به بک‌اند فعال می‌شود"
                >
                  بایگانی انتخاب‌شده‌ها
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<DeleteIcon />}
                  disabled
                  title="پس از اتصال به بک‌اند فعال می‌شود"
                >
                  حذف انتخاب‌شده‌ها
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sprint A2.2 (task 2) — the students query previously had no
            error state at all: a failed request just silently rendered an
            empty table. This reuses the exact retry pattern already used
            by GuardiansPage/TeacherAssignmentsPage (EmptyState + a
            secondary "تلاش مجدد" button calling the query's own refetch) —
            no new error-handling logic, just the existing
            parseApiError/getErrorMessage-adjacent convention applied here
            too. Filters/toolbar above stay usable during an error so the
            admin isn't blocked from adjusting them and retrying. */}
        {studentsQuery.isError ? (
          <EmptyState
            icon={<AlertIcon size={28} />}
            message="خطا در بارگذاری فهرست دانش‌آموزان"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => studentsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <>
            <Table
              stickyHeader
              density={density}
              columns={columns}
              data={pageItems}
              rowKey={(s) => s.id}
              selectedRowKeys={selectedIds}
              loading={loading}
              skeletonRows={6}
              emptyMessage={isFiltered ? 'دانش‌آموزی با این مشخصات یافت نشد.' : 'هنوز دانش‌آموزی ثبت نشده است.'}
              emptyDescription={
                isFiltered ? 'جستجو یا فیلترها را تغییر دهید.' : 'برای شروع، اولین دانش‌آموز مدرسه را ثبت کنید.'
              }
              emptyIcon={isFiltered ? <NoSearchResultsIcon /> : <StudentsEmptyIcon />}
              emptyAction={
                isFiltered ? (
                  <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                    پاک کردن فیلترها
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
                    + همین حالا اضافه کنید
                  </Button>
                )
              }
            />

            {!loading && totalCount > 0 && (
              <div className="mt-4 border-t border-line pt-4 text-center dark:border-white/10">
                <p className="tabular mb-2 text-xs text-ink/50 dark:text-paper/50">
                  نمایش {toPersianCount(rangeStart)}–{toPersianCount(rangeEnd)} از {toPersianCount(totalCount)}{' '}
                  دانش‌آموز
                </p>
                <Pagination page={page} pageCount={pageCount} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      <StudentProfileModal
        studentId={profileStudentId ?? undefined}
        open={profileStudentId !== null}
        onClose={() => setProfileStudentId(null)}
        role="admin"
      />
    </div>
  );
}

function toPersianCount(n: number): string {
  return n.toLocaleString('fa-IR');
}

// Sprint 3.3 — shared checkbox for the selection column (row checkboxes +
// header select-all). Wraps a native <input type="checkbox"> so it keeps
// full built-in keyboard/screen-reader behavior; `indeterminate` is set
// imperatively via ref since it isn't a real DOM attribute React can bind
// directly. Sized/colored from existing tokens only (action / line) —
// no new design system additions.
function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer rounded border-line text-action accent-action focus:outline-none focus:ring-2 focus:ring-action/30 dark:border-white/25"
    />
  );
}

// Sprint 3.3 toolbar/bar icons — same local convention as the Export/
// Import/Refresh/MoreFilters icons above (15x15, viewBox 0 0 24 24,
// currentColor stroke), kept page-local since they're specific to the
// bulk action bar rather than a general-purpose nav/domain icon.
function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4" width="17" height="4.5" rx="1.2" />
      <path d="M4.5 8.5v9.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5" />
      <path d="M10 13h4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.8c0-.6.5-1.1 1.1-1.1h2.8c.6 0 1.1.5 1.1 1.1V7" />
      <path d="M6.5 7l.9 12a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12" />
      <path d="M10.3 11v6M13.7 11v6" />
    </svg>
  );
}

function ClearSelectionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// Sprint 3.1 toolbar icons — kept local to this page (same convention as
// StudentsEmptyIcon below) rather than added to the shared SchoolIcons set,
// since they're specific to this toolbar's Export/Import/Refresh/"more
// filters" buttons rather than a general-purpose domain icon.
function ExportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9M20.5 12a8.5 8.5 0 0 1-14.6 5.9" />
      <path d="M18.1 3.6v3.2h-3.2" />
      <path d="M5.9 20.4v-3.2h3.2" />
    </svg>
  );
}

function MoreFiltersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function NoSearchResultsIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
      <path d="M8 10.5h5" opacity="0.6" />
    </svg>
  );
}

function StudentsEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20.5c0-3.5 3-6.2 6.5-6.2s6.5 2.7 6.5 6.2" />
      <circle cx="18" cy="8.5" r="2.4" />
      <path d="M17.5 14.5c2.8.4 5 2.7 5 5.6" />
      <path d="M9 8v.01M9 3v1M9 12v1" opacity="0.5" />
    </svg>
  );
}

function CreateStudentForm({
  grades,
  academicYears,
  saving,
  error,
  onSubmit,
}: {
  grades: Grade[];
  academicYears: AcademicYear[];
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (dto: {
    academicYearId: string;
    gradeId: string;
    classId?: string;
    fullName: string;
    nationalId?: string;
    enrollmentDate?: string;
    newGuardian: { fullName: string; phone: string };
  }) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState(() => academicYears.find((y) => y.isCurrent)?.id ?? '');
  const [classId, setClassId] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  useEffect(() => {
    if (!academicYearId) {
      const current = academicYears.find((y) => y.isCurrent);
      if (current) setAcademicYearId(current.id);
    }
  }, [academicYears]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sections of the selected grade for the selected year -- a class
  // belongs to exactly one (grade, academicYear) pair (see
  // CreateStudentDto's validation on the backend), so both must be
  // picked before this list means anything.
  const classesQuery = useClasses(gradeId && academicYearId ? { gradeId, academicYearId } : undefined);
  const classes = classesQuery.data ?? [];

  function handleGradeChange(value: string) {
    setGradeId(value);
    setClassId(''); // a class from the previous grade no longer applies
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Matches CreateStudentDto exactly: academicYearId + gradeId are
    // required; classId/nationalId/enrollmentDate are optional; guardian
    // is either an existing guardianId OR a newGuardian object, never both.
    onSubmit({
      academicYearId,
      gradeId,
      classId: classId || undefined,
      fullName,
      nationalId: nationalId || undefined,
      enrollmentDate: enrollmentDate || undefined,
      newGuardian: { fullName: guardianName, phone: guardianPhone },
    });
  }

  return (
    <Card title="ثبت دانش‌آموز جدید">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی دانش‌آموز">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </Field>

        <Field label="پایه تحصیلی">
          <select required value={gradeId} onChange={(e) => handleGradeChange(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="سال تحصیلی">
          <select required value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title} {y.isCurrent ? '(جاری)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="کلاس (اختیاری)">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!gradeId || !academicYearId}
            className="input"
          >
            <option value="">بدون کلاس مشخص</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {gradeId && academicYearId && classes.length === 0 && (
            <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
              برای این پایه و سال تحصیلی هنوز کلاسی ثبت نشده — از بخش تنظیمات می‌توانید کلاس اضافه کنید.
            </p>
          )}
        </Field>

        <Field label="کد ملی (اختیاری)">
          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="input tabular" />
        </Field>

        <Field label="تاریخ ثبت‌نام (اختیاری)">
          <PersianDatePicker value={enrollmentDate} onChange={setEnrollmentDate} />
        </Field>

        <Field label="نام والد">
          <input required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="input" />
        </Field>

        <Field label="شماره تلفن والد">
          <input
            type="tel"
            inputMode="tel"
            required
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            className="input"
            placeholder="۰۹۱۲xxxxxxx"
          />
        </Field>

        <div className="col-span-full">
          <FormError error={error} />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره دانش‌آموز'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
