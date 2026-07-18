import { useEffect, useMemo, useState, FormEvent, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/SearchInput';
import { Select } from '../components/Select';
import { FilterBar } from '../components/FilterBar';
import { Table, type TableColumn } from '../components/Table';
import { Pagination, paginate } from '../components/Pagination';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { PersianDatePicker } from '../components/PersianDatePicker';
import { SkeletonCards } from '../components/Skeleton';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from '../components/FormError';
import { exportToExcel } from '../lib/exportExcel';
import type { Student, Grade, AcademicYear } from '../types/student.types';
import { useStudents, useCreateStudent, useGrades, useAcademicYears } from '../hooks/useStudents';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

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
  const [search, setSearch] = useState('');
  // Search is live-as-you-type, debounced by SEARCH_DEBOUNCE_MS so it
  // doesn't refetch on every keystroke. `debouncedSearch` is the value
  // actually sent to the API / used in the query key; `search` above is
  // just the input's live text.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [gradeId, setGradeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [page, setPage] = useState(1);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);

  const studentsQuery = useStudents({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(gradeId ? { gradeId } : {}),
    ...(academicYearId ? { academicYearId } : {}),
  });
  const gradesQuery = useGrades();
  const academicYearsQuery = useAcademicYears();
  const createStudent = useCreateStudent();

  const students = studentsQuery.data ?? [];
  const grades = gradesQuery.data ?? [];
  const academicYears = academicYearsQuery.data ?? [];
  const loading = studentsQuery.isLoading;

  // Reset to page 1 whenever any filter narrows/widens the result set —
  // search (debounced), grade, or academic year — so pagination can't be
  // left pointing at a page that no longer exists under the new results.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, gradeId, academicYearId]);

  function handleExport() {
    exportToExcel(
      'دانش‌آموزان',
      'دانش‌آموزان',
      students.map((s) => ({
        نام: s.fullName,
        پایه: s.grade?.title ?? '',
        والد: s.guardian?.fullName ?? '',
        'تلفن والد': s.guardian?.phone ?? '',
        وضعیت: statusLabels[s.status],
      })),
    );
  }

  // Distinguishes "the roster is genuinely empty" (show an inviting
  // add-student CTA) from "a search/filter just happens to match nothing"
  // (show a plain no-results message instead).
  const isFiltered = Boolean(debouncedSearch || gradeId || academicYearId);

  const pageCount = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const pageItems = useMemo(() => paginate(students, page, PAGE_SIZE), [students, page]);

  // Stats derived entirely from the already-fetched `students` list — no
  // separate endpoint/mock data. They reflect whatever's currently loaded
  // (i.e. the active search, if any), same as the table below.
  const totalCount = students.length;
  const activeCount = useMemo(() => students.filter((s) => s.status === 'active').length, [students]);
  const inactiveCount = totalCount - activeCount;
  // "New this month" only exists because Student.enrollmentDate is a real
  // backend field — this counts students whose enrollmentDate falls in the
  // current calendar month/year. Students without an enrollmentDate are
  // simply not counted, not treated as 0/fake.
  const newThisMonthCount = useMemo(() => {
    const now = new Date();
    return students.filter((s) => {
      if (!s.enrollmentDate) return false;
      const d = new Date(s.enrollmentDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [students]);

  const columns: TableColumn<Student>[] = [
    {
      key: 'name',
      header: 'نام',
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
      cellClassName: 'text-ink/70 dark:text-paper/70',
      render: (s) => s.guardian?.fullName ?? '—',
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (s) => <StudentStatusBadge status={s.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (s) => (
        <Link to={`/students/${s.id}`} className="text-sm font-medium text-action hover:underline">
          صورت‌حساب
        </Link>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="دانش‌آموزان"
        description="مدیریت اطلاعات، وضعیت ثبت‌نام و صورت‌حساب دانش‌آموزان"
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((v) => !v)}>
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

      <Card className="mt-6">
        <FilterBar
          actions={
            <>
              <Link to="/students/archived" className="btn-secondary">
                غیرفعال‌ها
              </Link>
              <Button variant="secondary" onClick={handleExport}>
                خروجی Excel
              </Button>
            </>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="جستجو با نام..."
            containerClassName="w-56 sm:w-64"
          />
          <Select
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            options={[{ value: '', label: 'همه‌ی پایه‌ها' }, ...grades.map((g) => ({ value: g.id, label: g.title }))]}
            containerClassName="w-auto"
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
          />
        </FilterBar>

        <Table
          stickyHeader
          columns={columns}
          data={pageItems}
          rowKey={(s) => s.id}
          loading={loading}
          skeletonRows={6}
          emptyMessage={isFiltered ? 'دانش‌آموزی با این مشخصات یافت نشد.' : 'هنوز دانش‌آموزی ثبت نشده است.'}
          emptyDescription={
            isFiltered ? 'جستجو یا فیلترها را تغییر دهید.' : 'برای شروع، اولین دانش‌آموز مدرسه را ثبت کنید.'
          }
          emptyIcon={isFiltered ? undefined : <StudentsEmptyIcon />}
          emptyAction={
            isFiltered ? undefined : (
              <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
                + همین حالا اضافه کنید
              </Button>
            )
          }
        />

        {!loading && students.length > 0 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      </Card>
    </div>
  );
}

function toPersianCount(n: number): string {
  return n.toLocaleString('fa-IR');
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 14c2.5.3 4.5 2.3 4.5 4.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
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

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
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
