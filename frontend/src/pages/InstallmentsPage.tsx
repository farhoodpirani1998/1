import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { FilterBar } from '../components/FilterBar';
import { SearchInput } from '../components/SearchInput';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { Table, type TableColumn } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination, paginate } from '../components/Pagination';
import { RecordPaymentModal, PayableInstallment } from '../components/RecordPaymentModal';
import { formatToman, formatDate, toPersianDigits } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import type { InstallmentWithStudent, InstallmentStatus } from '../types/tuition.types';
import { useInstallments } from '../hooks/useInstallments';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTableSort } from '../hooks/useTableSort';

const PAGE_SIZE = 15;

const statusLabels: Record<InstallmentStatus, string> = {
  overdue: 'معوق',
  pending: 'در انتظار',
  partial: 'پرداخت جزئی',
  paid: 'پرداخت‌شده',
  cancelled: 'لغوشده',
  deferred: 'موکول‌شده',
  disputed: 'مورد اختلاف',
};

const statusOptions: { value: InstallmentStatus | ''; label: string }[] = [
  { value: '', label: 'همه‌ی وضعیت‌ها' },
  { value: 'overdue', label: 'معوق' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'partial', label: 'پرداخت جزئی' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'deferred', label: 'موکول‌شده' },
  { value: 'disputed', label: 'مورد اختلاف' },
  { value: 'cancelled', label: 'لغوشده' },
];

export function InstallmentsPage() {
  const [status, setStatus] = useState<InstallmentStatus | ''>('');
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [payingInstallment, setPayingInstallment] = useState<PayableInstallment | null>(null);

  const installmentsQuery = useInstallments(status ? { status } : undefined);
  const installments = installmentsQuery.data ?? [];
  const loading = installmentsQuery.isLoading;

  // Note: this filter runs entirely client-side against the already-
  // fetched `installments` list — the backend's /installments endpoint
  // has no `search` query param, so there's no request to debounce here.
  // The debounce still applies to when the filter itself (re)computes,
  // so typing doesn't re-filter/re-render on every keystroke.
  const debouncedNameFilter = useDebouncedValue(nameFilter, 400);

  useEffect(() => setPage(1), [status, debouncedNameFilter]);

  const filtered = debouncedNameFilter
    ? installments.filter((i) => i.tuitionPlan.student.fullName.includes(debouncedNameFilter))
    : installments;

  const { sort, toggleSort } = useTableSort();

  // Sorting runs after status + name filtering (`filtered`, above) and
  // before pagination slices it — same ordering the filters already use.
  // Only the three columns actually rendered below (Due Date, Amount,
  // Status) are sortable.
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort.key === 'dueDate') {
        cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sort.key === 'amount') {
        cmp = a.amount - b.amount;
      } else if (sort.key === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = useMemo(() => paginate(sorted, page, PAGE_SIZE), [sorted, page]);

  // Two distinct empty states, same idea as StudentsPage: no installments
  // exist at all yet (guide the user to Students, since tuition
  // plans/installments are created from a student's profile — this page
  // has no create-tuition-plan flow of its own) vs. status/name filters
  // simply match nothing (guide the user to adjust them instead).
  const hasActiveFilters = Boolean(status || debouncedNameFilter);

  function handleExport() {
    exportToExcel(
      'اقساط',
      'اقساط',
      filtered.map((i) => ({
        دانش‌آموز: i.tuitionPlan.student.fullName,
        قسط: i.installmentNumber,
        سررسید: i.dueDate,
        'مبلغ (تومان)': i.amount,
        'پرداخت‌شده (تومان)': i.paidAmount,
        وضعیت: statusLabels[i.status],
      })),
    );
  }

  const overdueCount = useMemo(() => installments.filter((i) => i.status === 'overdue').length, [installments]);
  const pendingCount = useMemo(
    () => installments.filter((i) => i.status === 'pending' || i.status === 'partial').length,
    [installments],
  );

  const columns: TableColumn<InstallmentWithStudent>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (inst) => (
        <Link to={`/students/${inst.tuitionPlan.student.id}`} className="font-medium text-action hover:underline">
          {inst.tuitionPlan.student.fullName}
        </Link>
      ),
    },
    {
      key: 'number',
      header: 'قسط',
      cellClassName: 'tabular',
      render: (inst) => toPersianDigits(inst.installmentNumber),
    },
    {
      key: 'dueDate',
      header: 'سررسید',
      sortable: true,
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (inst) => formatDate(inst.dueDate),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      sortable: true,
      cellClassName: 'tabular font-medium',
      render: (inst) => formatToman(inst.amount),
    },
    {
      key: 'status',
      header: 'وضعیت',
      sortable: true,
      render: (inst) => <StatusBadge status={inst.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (inst) =>
        inst.status !== 'paid' && inst.status !== 'cancelled' ? (
          <button
            onClick={() => setPayingInstallment(inst)}
            className="text-xs font-medium text-action hover:underline"
          >
            ثبت پرداخت
          </button>
        ) : null,
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="اقساط و پرداخت‌ها"
        description="پیگیری سررسیدها، ثبت پرداخت و خروجی گرفتن از فهرست اقساط"
        actions={
          <Button variant="secondary" size="sm" onClick={handleExport}>
            خروجی Excel
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="کل اقساط" value={loading ? '—' : toPersianDigits(installments.length)} />
        <StatCard
          label="در انتظار پرداخت"
          value={loading ? '—' : toPersianDigits(pendingCount)}
          accent="warning"
        />
        <StatCard label="معوق" value={loading ? '—' : toPersianDigits(overdueCount)} accent="overdue" />
      </div>

      <Card>
        <FilterBar>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as InstallmentStatus | '')}
            options={statusOptions}
            containerClassName="w-auto"
          />
          <SearchInput
            value={nameFilter}
            onChange={setNameFilter}
            placeholder="فیلتر بر اساس نام دانش‌آموز..."
            containerClassName="w-full sm:w-64"
          />
        </FilterBar>

        <Table
          columns={columns}
          data={pageItems}
          rowKey={(inst) => inst.id}
          loading={loading}
          skeletonRows={8}
          emptyMessage={hasActiveFilters ? 'قسطی یافت نشد.' : 'هنوز قسطی ثبت نشده است.'}
          emptyDescription={
            hasActiveFilters
              ? 'فیلترها را تغییر دهید یا عبارت جستجو را پاک کنید.'
              : 'اقساط با ایجاد برنامه شهریه برای یک دانش‌آموز ساخته می‌شوند.'
          }
          emptyIcon={<InstallmentsIcon />}
          emptyAction={
            !hasActiveFilters ? (
              <Link to="/students" className="btn-secondary text-sm">
                رفتن به دانش‌آموزان
              </Link>
            ) : undefined
          }
          sortKey={sort?.key ?? null}
          sortDirection={sort?.direction ?? null}
          onSortChange={toggleSort}
        />

        {!loading && filtered.length > 0 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      </Card>

      {payingInstallment && (
        <RecordPaymentModal
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSaved={() => setPayingInstallment(null)}
        />
      )}
    </div>
  );
}

// Local, inline-SVG icon — same convention already used for icons across
// the app (e.g. UsersIcon/CalendarIcon in StudentsPage): a small stroked
// glyph colocated with the page that uses it, not a shared component.
function InstallmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4M8 12h7M8 16h4" />
    </svg>
  );
}
