import { useEffect, useState } from 'react';
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
import { Pagination } from '../components/Pagination';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { SkeletonCards } from '../components/Skeleton';
import { formatToman, formatDate, toPersianDigits } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import { fetchAllPages } from '../lib/fetchAllPages';
import { getInstallmentsPaginated } from '../api/tuition.api';
import type { InstallmentWithStudent, InstallmentStatus } from '../types/tuition.types';
import { useInstallmentsPaginated } from '../hooks/useInstallments';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useToast } from '../lib/toast';
import { getErrorMessage } from '../lib/error-handler';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

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
  const { showError } = useToast();
  const [status, setStatus] = useState<InstallmentStatus | ''>('');
  const [nameFilter, setNameFilter] = useState('');
  // Search is now sent to the backend (see QueryInstallmentsDto.search),
  // so it's debounced the same way StudentsPage debounces its search —
  // otherwise every keystroke would trigger a refetch.
  const debouncedNameFilter = useDebouncedValue(nameFilter, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [payingInstallment, setPayingInstallment] = useState<InstallmentWithStudent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<'all' | 'selected' | null>(null);

  const listParams = {
    ...(status ? { status } : {}),
    ...(debouncedNameFilter ? { search: debouncedNameFilter } : {}),
  };

  // Phase 4B: real server-side pagination — the table only ever holds
  // one page (PAGE_SIZE rows) in memory; `total` is the true count for
  // the current status+search filters, not capped at MAX_PAGE_LIMIT.
  const installmentsQuery = useInstallmentsPaginated(page, PAGE_SIZE, listParams);
  const pageItems = installmentsQuery.data?.data ?? [];
  const totalCount = installmentsQuery.data?.total ?? 0;
  const loading = installmentsQuery.isLoading;

  // Stat cards below are intentionally school-wide (ignore the status
  // dropdown and the search box) rather than "count within whatever's
  // currently filtered" like the old client-side version did — showing
  // e.g. "۰ معوق" just because someone picked "پرداخت‌شده" in the
  // dropdown was more confusing than useful. Cheap: limit=1 still gets
  // an accurate total via getManyAndCount without fetching any rows.
  const totalAllQuery = useInstallmentsPaginated(1, 1, undefined);
  const overdueCountQuery = useInstallmentsPaginated(1, 1, { status: 'overdue' });
  const pendingOnlyCountQuery = useInstallmentsPaginated(1, 1, { status: 'pending' });
  const partialCountQuery = useInstallmentsPaginated(1, 1, { status: 'partial' });

  useEffect(() => {
    setPage(1);
  }, [status, debouncedNameFilter]);

  function toggleSelect(id: string) {
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

  const allPageSelected = pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        const next = new Set(prev);
        pageItems.forEach((i) => next.delete(i.id));
        return next;
      }
      const next = new Set(prev);
      pageItems.forEach((i) => next.add(i.id));
      return next;
    });
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function toExportRows(rows: InstallmentWithStudent[]) {
    return rows.map((i) => ({
      دانش‌آموز: i.tuitionPlan.student.fullName,
      قسط: i.installmentNumber,
      سررسید: i.dueDate,
      'مبلغ (تومان)': i.amount,
      'پرداخت‌شده (تومان)': i.paidAmount,
      وضعیت: statusLabels[i.status],
    }));
  }

  async function handleExport() {
    setExporting('all');
    try {
      const all = await fetchAllPages((p, l) =>
        getInstallmentsPaginated(p, l, listParams).then((res) => res.data),
      );
      exportToExcel('اقساط', 'اقساط', toExportRows(all));
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  async function handleExportSelected() {
    setExporting('selected');
    try {
      // selectedIds can span multiple pages (selection isn't reset on
      // page change), so this needs every matching row, not just the
      // current page, to know which of them are actually selected.
      const all = await fetchAllPages((p, l) =>
        getInstallmentsPaginated(p, l, listParams).then((res) => res.data),
      );
      exportToExcel(
        'اقساط-انتخاب‌شده',
        'اقساط',
        toExportRows(all.filter((i) => selectedIds.has(i.id))),
      );
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const totalAllCount = totalAllQuery.data?.total ?? 0;
  const overdueCount = overdueCountQuery.data?.total ?? 0;
  const pendingCount = (pendingOnlyCountQuery.data?.total ?? 0) + (partialCountQuery.data?.total ?? 0);

  const columns: TableColumn<InstallmentWithStudent>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={toggleSelectAll}
          aria-label="انتخاب همه"
          className="cursor-pointer"
        />
      ),
      align: 'center',
      render: (inst) => (
        <input
          type="checkbox"
          checked={selectedIds.has(inst.id)}
          onChange={() => toggleSelect(inst.id)}
          aria-label="انتخاب ردیف"
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
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
      cellClassName: 'tabular text-ink/70 dark:text-paper/70',
      render: (inst) => formatDate(inst.dueDate),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      cellClassName: 'tabular font-medium',
      render: (inst) => formatToman(inst.amount),
    },
    {
      key: 'status',
      header: 'وضعیت',
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
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSelected}
              disabled={selectedIds.size === 0 || exporting !== null}
              loading={exporting === 'selected'}
            >
              خروجی انتخاب‌شده‌ها
              {selectedIds.size > 0 ? ` (${toPersianDigits(selectedIds.size)})` : ''}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={exporting !== null}
              loading={exporting === 'all'}
            >
              خروجی Excel
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="mb-6">
          <SkeletonCards count={3} />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="کل اقساط" value={toPersianDigits(totalAllCount)} />
          <StatCard label="در انتظار پرداخت" value={toPersianDigits(pendingCount)} accent="warning" />
          <StatCard label="معوق" value={toPersianDigits(overdueCount)} accent="overdue" />
        </div>
      )}

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
          stickyHeader
          columns={columns}
          data={pageItems}
          rowKey={(inst) => inst.id}
          loading={loading}
          skeletonRows={8}
          emptyMessage="موردی یافت نشد."
          emptyDescription="فیلترها را تغییر دهید یا عبارت جستجو را پاک کنید."
        />

        {!loading && totalCount > 0 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      </Card>

      {payingInstallment && (
        <RecordPaymentModal
          installment={payingInstallment}
          studentName={payingInstallment.tuitionPlan.student.fullName}
          onClose={() => setPayingInstallment(null)}
          onSaved={() => setPayingInstallment(null)}
        />
      )}
    </div>
  );
}
