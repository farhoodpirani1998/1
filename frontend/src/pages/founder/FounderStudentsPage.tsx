import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { SearchInput } from '../../components/SearchInput';
import { Select } from '../../components/Select';
import { FilterBar } from '../../components/FilterBar';
import { Table, type TableColumn } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useFounderSchoolStudents } from '../../hooks/useFounder';
import type { FounderStudent, FounderStudentStatus } from '../../types/founder.types';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const statusLabels: Record<FounderStudentStatus, string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

const statusBadgeClass: Record<FounderStudentStatus, string> = {
  active: 'bg-paid/10 text-paid border-paid/25',
  withdrawn: 'bg-overdue/10 text-overdue border-overdue/25',
  graduated: 'bg-action-soft text-action border-action/25',
};

function StudentStatusBadge({ status }: { status: FounderStudentStatus }) {
  return (
    <span className={`badge ${statusBadgeClass[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

function StudentsEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20.5c0-3.5 3-6.2 6.5-6.2s6.5 2.7 6.5 6.2" />
      <circle cx="18" cy="8.5" r="2.4" />
      <path d="M17.5 14.5c2.8.4 5 2.7 5 5.6" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'active', label: statusLabels.active },
  { value: 'withdrawn', label: statusLabels.withdrawn },
  { value: 'graduated', label: statusLabels.graduated },
];

// Only /founder/schools/:schoolId/students supports server-side page/limit
// (see founder-frontend-prompt.md §4). Search is live-as-you-type: `search`
// is the input's raw value, `debouncedSearch` (via useDebouncedValue, 300ms)
// is what's actually sent to the API/query key, so fast typing doesn't fire
// a request per keystroke. Status filter still applies immediately. The
// backend returns a plain array with no total count, so "next page" is
// inferred from a full page coming back (see hasNextPage below) rather than
// a real page count.
export function FounderStudentsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<FounderStudentStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  const studentsQuery = useFounderSchoolStudents(schoolId, {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isLoading;
  const hasNextPage = students.length === PAGE_SIZE;

  const columns: TableColumn<FounderStudent>[] = [
    {
      key: 'name',
      header: 'نام',
      render: (s) => <span className="font-medium text-ink dark:text-paper">{s.fullName}</span>,
    },
    { key: 'status', header: 'وضعیت', render: (s) => <StudentStatusBadge status={s.status} /> },
    { key: 'grade', header: 'پایه', cellClassName: 'text-ink/70 dark:text-paper/70', render: (s) => s.grade?.title ?? '—' },
    { key: 'guardian', header: 'والد', cellClassName: 'text-ink/70 dark:text-paper/70', render: (s) => s.guardian?.fullName ?? '—' },
    { key: 'guardianPhone', header: 'تلفن والد', cellClassName: 'tabular text-ink/70 dark:text-paper/70', render: (s) => s.guardian?.phone ?? '—' },
  ];

  return (
    <Card>
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          placeholder="جستجوی نام دانش‌آموز..."
          containerClassName="w-56 sm:w-64"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as FounderStudentStatus | '')}
          options={STATUS_OPTIONS}
          containerClassName="w-40"
        />
      </FilterBar>

      <Table
        stickyHeader
        columns={columns}
        data={students}
        rowKey={(s) => s.id}
        loading={loading}
        skeletonRows={8}
        emptyMessage={debouncedSearch || status ? 'دانش‌آموزی با این مشخصات یافت نشد.' : 'هنوز دانش‌آموزی در این مدرسه ثبت نشده است.'}
        emptyDescription={debouncedSearch ? 'برای این جستجو نتیجه‌ای پیدا نشد؛ املا را بررسی کنید.' : undefined}
        emptyIcon={debouncedSearch || status ? undefined : <StudentsEmptyIcon />}
      />

      {!loading && (
        <Pagination page={page} hasNextPage={hasNextPage} onChange={(p) => setPage(Math.max(1, p))} />
      )}
    </Card>
  );
}
