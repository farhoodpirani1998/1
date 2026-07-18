import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { SearchInput } from '../../components/SearchInput';
import { Select } from '../../components/Select';
import { FilterBar } from '../../components/FilterBar';
import { Table, type TableColumn } from '../../components/Table';
import { useFounderSchoolStudents } from '../../hooks/useFounder';
import type { FounderStudent, FounderStudentStatus } from '../../types/founder.types';

const PAGE_SIZE = 20;

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

const STATUS_OPTIONS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'active', label: statusLabels.active },
  { value: 'withdrawn', label: statusLabels.withdrawn },
  { value: 'graduated', label: statusLabels.graduated },
];

// Only /founder/schools/:schoolId/students supports server-side page/limit
// (see founder-frontend-prompt.md §4) — search is submit-triggered (same
// convention as the school_admin StudentsPage), status filter applies
// immediately. The backend returns a plain array with no total count, so
// "next page" is inferred from a full page coming back (see hasNextPage
// below) rather than a real page count.
export function FounderStudentsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [status, setStatus] = useState<FounderStudentStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status, submittedSearch]);

  const studentsQuery = useFounderSchoolStudents(schoolId, {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(submittedSearch ? { search: submittedSearch } : {}),
  });

  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isLoading;
  const hasNextPage = students.length === PAGE_SIZE;

  function runSearch(e: FormEvent) {
    e.preventDefault();
    setSubmittedSearch(search);
  }

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
      <form onSubmit={runSearch}>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} onSubmit={() => setSubmittedSearch(search)} placeholder="جستجوی نام دانش‌آموز..." containerClassName="w-56 sm:w-64" />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as FounderStudentStatus | '')}
            options={STATUS_OPTIONS}
            containerClassName="w-40"
          />
        </FilterBar>
      </form>

      <Table
        columns={columns}
        data={students}
        rowKey={(s) => s.id}
        loading={loading}
        skeletonRows={8}
        emptyMessage="دانش‌آموزی یافت نشد."
      />

      {!loading && (page > 1 || hasNextPage) && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink/70 transition-colors hover:bg-paper disabled:pointer-events-none disabled:opacity-35 dark:border-white/15 dark:text-paper/70 dark:hover:bg-white/10"
          >
            قبلی
          </button>
          <span className="tabular text-sm text-ink/60 dark:text-paper/60">صفحه {page.toLocaleString('fa-IR')}</span>
          <button
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink/70 transition-colors hover:bg-paper disabled:pointer-events-none disabled:opacity-35 dark:border-white/15 dark:text-paper/70 dark:hover:bg-white/10"
          >
            بعدی
          </button>
        </div>
      )}
    </Card>
  );
}
