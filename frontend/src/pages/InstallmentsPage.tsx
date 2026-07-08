import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows } from '../components/Skeleton';
import { Pagination, paginate } from '../components/Pagination';
import { RecordPaymentModal, PayableInstallment } from '../components/RecordPaymentModal';
import { formatToman, formatDate } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import type { InstallmentStatus } from '../types/tuition.types';
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
  const [payingInstallment, setPayingInstallment] = useState<PayableInstallment | null>(null);

  const installmentsQuery = useInstallments(status ? { status } : undefined);
  const installments = installmentsQuery.data ?? [];
  const loading = installmentsQuery.isLoading;

  useEffect(() => setPage(1), [status, nameFilter]);

  const filtered = nameFilter
    ? installments.filter((i) => i.tuitionPlan.student.fullName.includes(nameFilter))
    : installments;

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

  return (
    <div className="fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">اقساط و پرداخت‌ها</h1>
        <button onClick={handleExport} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper">
          خروجی Excel
        </button>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value as InstallmentStatus | '')} className="input w-auto">
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="فیلتر بر اساس نام دانش‌آموز..."
            className="input flex-1 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <SkeletonRows rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink/50">موردی یافت نشد.</div>
        ) : (
          <>
            <table className="ledger-lines w-full text-sm">
              <thead>
                <tr className="text-right text-ink/50">
                  <th className="py-2 font-medium">دانش‌آموز</th>
                  <th className="py-2 font-medium">قسط</th>
                  <th className="py-2 font-medium">سررسید</th>
                  <th className="py-2 font-medium">مبلغ</th>
                  <th className="py-2 font-medium">وضعیت</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((inst) => (
                  <tr key={inst.id}>
                    <td className="py-2">
                      <Link to={`/students/${inst.tuitionPlan.student.id}`} className="text-action hover:underline">
                        {inst.tuitionPlan.student.fullName}
                      </Link>
                    </td>
                    <td className="tabular py-2">{inst.installmentNumber}</td>
                    <td className="tabular py-2 text-ink/70">{formatDate(inst.dueDate)}</td>
                    <td className="tabular py-2">{formatToman(inst.amount)}</td>
                    <td className="py-2">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="py-2 text-left">
                      {inst.status !== 'paid' && inst.status !== 'cancelled' && (
                        <button
                          onClick={() => setPayingInstallment(inst)}
                          className="text-xs font-medium text-action hover:underline"
                        >
                          ثبت پرداخت
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )}
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
