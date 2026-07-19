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
} from '../hooks/useStudents';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { UsersIcon, CheckIcon, AlertIcon, CalendarIcon, ChevronEnterIcon } from '../components/icons/SchoolIcons';
import { BulkImportStudentsPanel } from '../components/BulkImportStudentsPanel';

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
  // Sprint 3.1 — toolbar shell only. These two are intentionally NOT part
  // of filterParams below: per the Sprint 3.1 spec, Status and Class are
  // visual placeholders with no filtering logic yet. Class in particular
  // has no backing field on Student today (only `grade`), so it can't be
  // wired to a real query param until that data model question is settled
  // — left for Sprint 3.2.
  const [statusFilterDisplay, setStatusFilterDisplay] = useState('');
  const [classFilterDisplay, setClassFilterDisplay] = useState('');
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

  const filterParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(gradeId ? { gradeId } : {}),
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
  }, [debouncedSearch, gradeId, academicYearId]);

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
  const isFiltered = Boolean(debouncedSearch || gradeId || academicYearId);

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
      header: '',
      align: 'left',
      render: (s) => (
        <Link
          to={`/students/${s.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-sm font-medium text-action transition-colors hover:border-action/25 hover:bg-action-soft dark:hover:bg-action/10"
        >
          صورت‌حساب
          <ChevronEnterIcon size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="fade-in">
      {/* Sprint 3.1 — workspace header. Same title/description/action data
          and handlers as before, just restyled: a student-count pill next
          to the title (reuses `totalCount`, already fetched for the stat
          cards below — no new query), and a single primary action per the
          Sprint 3.1 header spec. The bulk-import toggle keeps its exact
          existing state/handler (`showBulkImport`/`setShowBulkImport`) but
          is now surfaced as the toolbar's "Import" button instead of a
          second header action — see the toolbar Actions area below. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-ink dark:text-paper">دانش‌آموزان</h1>
            <span
              className="badge border-line bg-ink/5 text-ink/60 dark:border-white/10 dark:bg-white/10 dark:text-paper/60"
              aria-label="تعداد کل دانش‌آموزان"
            >
              <UsersIcon size={12} />
              {loading ? '…' : `${toPersianCount(totalCount)} دانش‌آموز`}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink/55 dark:text-paper/55">
            مدیریت اطلاعات، وضعیت ثبت‌نام و صورت‌حساب دانش‌آموزان
          </p>
        </div>
        <Button
          variant={showForm ? 'secondary' : 'primary'}
          onClick={() => {
            setShowForm((v) => !v);
            setShowBulkImport(false);
          }}
        >
          {showForm ? 'انصراف' : '+ دانش‌آموز جدید'}
        </Button>
      </div>

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
        <div className="mb-4 border-b border-line pb-4 dark:border-white/10">
          <FilterBar
            actions={
              <>
                <Link to="/students/archived" className="btn-secondary">
                  غیرفعال‌ها
                </Link>
                <Button variant="secondary" leftIcon={<ImportIcon />} onClick={() => { setShowBulkImport((v) => !v); setShowForm(false); }}>
                  ورودی اکسل
                </Button>
                <Button variant="secondary" leftIcon={<ExportIcon />} onClick={handleExport} loading={exporting}>
                  خروجی اکسل
                </Button>
                {/* Sprint 3.1 — visual only. Wiring this to studentsQuery /
                    activeCountQuery / gradesQuery / academicYearsQuery
                    refetch is a one-line change but is deliberately left
                    for Sprint 3.2 so this sprint stays UI-shell-only. */}
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
            <Select
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
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
            {/* Sprint 3.1 — visual-only placeholder. Student has no `class`/
                section field yet (only `grade`), so there is no real data
                to filter by until that's added — see Sprint 3.2 notes. */}
            <Select
              value={classFilterDisplay}
              onChange={(e) => setClassFilterDisplay(e.target.value)}
              options={[{ value: '', label: 'همه‌ی کلاس‌ها' }]}
              containerClassName="w-auto"
              aria-label="فیلتر کلاس (به‌زودی)"
            />
            <Button variant="ghost" leftIcon={<MoreFiltersIcon />}>
              فیلترهای بیشتر
            </Button>
          </FilterBar>
        </div>

        {/* Sprint 3.3 — bulk action bar, shown only once at least one row
            is selected. Purely visual/UI-state: count + clear come from
            selectedIds already in scope, and the three action buttons are
            deliberately unwired placeholders (disabled, with the same
            "not connected yet" tooltip convention used elsewhere in this
            codebase — see DashboardPage's StaffDashboard checklist). */}
        {selectedIds.size > 0 && (
          <div
            role="region"
            aria-label="نوار عملیات گروهی"
            className="fade-in mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-action/25 bg-action-soft px-4 py-2.5 dark:border-action/30 dark:bg-action/10"
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

        <Table
          stickyHeader
          density="comfortable"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setGradeId('');
                  setAcademicYearId('');
                  // Visual-only placeholders from Sprint 3.1 — reset for
                  // consistency even though they don't drive the query.
                  setStatusFilterDisplay('');
                  setClassFilterDisplay('');
                }}
              >
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
              نمایش {toPersianCount(rangeStart)}–{toPersianCount(rangeEnd)} از {toPersianCount(totalCount)} دانش‌آموز
            </p>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </Card>
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
    fullName: string;
    nationalId?: string;
    enrollmentDate?: string;
    newGuardian: { fullName: string; phone: string };
  }) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState(() => academicYears.find((y) => y.isCurrent)?.id ?? '');
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Matches CreateStudentDto exactly: academicYearId + gradeId are
    // required; nationalId/enrollmentDate are optional; guardian is
    // either an existing guardianId OR a newGuardian object, never both.
    onSubmit({
      academicYearId,
      gradeId,
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
          <select required value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="input">
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
