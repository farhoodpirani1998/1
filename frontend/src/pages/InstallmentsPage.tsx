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
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { SkeletonCards } from '../components/Skeleton';
import { formatToman, formatDate, toPersianDigits } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import type { InstallmentWithStudent, InstallmentStatus } from '../types/tuition.types';
import { useInstallments } from '../hooks/useInstallments';

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
  const [payingInstallment, setPayingInstallment] = useState<InstallmentWithStudent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const installmentsQuery = useInstallments(status ? { status } : undefined);
  const installments = installmentsQuery.data ?? [];
  const loading = installmentsQuery.isLoading;

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [status, nameFilter]);

  const filtered = nameFilter
    ? installments.filter((i) => i.tuitionPlan.student.fullName.includes(nameFilter))
    : installments;

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

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        return new Set();
      }
      const next = new Set(prev);
      filtered.forEach((i) => next.add(i.id));
      return next;
    });
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page]);

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

  function handleExportSelected() {
    exportToExcel(
      'اقساط-انتخاب‌شده',
      'اقساط',
      filtered
        .filter((i) => selectedIds.has(i.id))
        .map((i) => ({
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
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
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
              disabled={selectedIds.size === 0}
            >
              خروجی انتخاب‌شده‌ها
              {selectedIds.size > 0 ? ` (${toPersianDigits(selectedIds.size)})` : ''}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
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
          <StatCard label="کل اقساط" value={toPersianDigits(installments.length)} />
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
          columns={columns}
          data={pageItems}
          rowKey={(inst) => inst.id}
          loading={loading}
          skeletonRows={8}
          emptyMessage="موردی یافت نشد."
          emptyDescription="فیلترها را تغییر دهید یا عبارت جستجو را پاک کنید."
        />

        {!loading && filtered.length > 0 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
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
