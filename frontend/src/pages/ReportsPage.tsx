import { useMemo, useState } from 'react';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { Table, type TableColumn } from '../components/Table';
import { Pagination, paginate } from '../components/Pagination';
import { Button } from '../components/Button';
import { SkeletonRows } from '../components/Skeleton';
import { formatToman, toPersianDigits } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import type { InstallmentStatus } from '../types/tuition.types';
import type { DebtorStudent } from '../types/report.types';
import { useOverdueSummary, useDebtorStudents, useMonthlyIncomeTrend } from '../hooks/useReports';
import { useInstallments } from '../hooks/useInstallments';

const PAGE_SIZE = 10;

const statusLabels: Record<InstallmentStatus, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  overdue: 'معوق',
  partial: 'جزئی',
  cancelled: 'لغوشده',
  deferred: 'موکول‌شده',
  disputed: 'مورد اختلاف',
};

const statusColors: Record<InstallmentStatus, string> = {
  pending: '#0F1E3D',
  paid: '#1F8A55',
  overdue: '#C0392B',
  partial: '#C79A1E',
  cancelled: '#9CA3AF',
  deferred: '#1D3766',
  disputed: '#C0392B',
};

const persianMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export function ReportsPage() {
  const summaryQuery = useOverdueSummary();
  const installmentsQuery = useInstallments();

  const summary = summaryQuery.data ?? null;
  const loading = summaryQuery.isLoading || installmentsQuery.isLoading;

  const chartData = useMemo(() => {
    const installments = installmentsQuery.data ?? [];
    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const inst of installments) {
      const key = inst.status;
      if (!byStatus[key]) byStatus[key] = { count: 0, amount: 0 };
      byStatus[key].count += 1;
      byStatus[key].amount += Number(inst.amount) - Number(inst.paidAmount);
    }
    return (Object.keys(statusLabels) as InstallmentStatus[]).map((status) => ({
      status: statusLabels[status],
      count: byStatus[status]?.count ?? 0,
      amount: byStatus[status]?.amount ?? 0,
      fill: statusColors[status],
    }));
  }, [installmentsQuery.data]);

  return (
    <div className="fade-in">
      <PageHeader title="گزارش‌ها" description="نمای کلی وضعیت مالی، بدهکاران و روند درآمد" />

      {loading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatBox label="اقساط معوق" value={summary ? toPersianDigits(summary.overdueInstallmentCount) : '—'} />
            <StatBox label="دانش‌آموزان بدهکار" value={summary ? toPersianDigits(summary.overdueStudentCount) : '—'} />
            <StatBox label="جمع مبلغ معوق" value={summary ? formatToman(summary.totalOverdueAmount) : '—'} accent />
          </div>

          <IncomeTrendPanel />
          <DebtorStudentsPanel />

          <Card title="توزیع اقساط بر اساس وضعیت (تعداد)" className="mt-4">
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
                  <XAxis dataKey="status" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value: number) => toPersianDigits(value)} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="مبلغ باقیمانده بر اساس وضعیت (تومان)" className="mt-4">
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
                  <XAxis dataKey="status" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => toPersianDigits(String(v))} />
                  <Tooltip formatter={(value: number) => formatToman(value)} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// Backend only exposes GET /reports/monthly-income?year&month, returning
// ONE aggregate per call — there is no daily-series endpoint. This builds
// a monthly trend by calling it once per month (last 6 months) instead of
// asking for a backend change.
function IncomeTrendPanel() {
  const months = useMemo(() => {
    const now = new Date();
    const result: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return result;
  }, []);

  const results = useMonthlyIncomeTrend(months);
  const loading = results.some((r) => r.isLoading);
  const points = results.map((r, i) => ({
    ...(r.data ?? { year: months[i].year, month: months[i].month, totalIncome: 0, paymentCount: 0 }),
    label: `${persianMonthNames[months[i].month - 1]} ${months[i].year}`,
  }));

  const total = points.reduce((sum, p) => sum + p.totalIncome, 0);

  function handleExport() {
    exportToExcel(
      'درآمد-ماهانه',
      'درآمد ماهانه',
      points.map((p) => ({ ماه: p.label, 'مبلغ (تومان)': p.totalIncome, 'تعداد پرداخت': p.paymentCount })),
    );
  }

  return (
    <Card
      title="روند درآمد (۶ ماه اخیر)"
      className="mt-4"
      action={
        <div className="flex items-center gap-3">
          <div className="text-sm text-ink/60 dark:text-paper/60">
            جمع ۶ ماه: <span className="tabular font-bold text-paid">{formatToman(total)}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            خروجی Excel
          </Button>
        </div>
      }
    >
      {loading ? (
        <SkeletonRows rows={3} cols={4} />
      ) : (
        <div dir="ltr" className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={12} tickFormatter={(v) => toPersianDigits(String(v))} />
              <Tooltip formatter={(value: number) => formatToman(value)} />
              <Line type="monotone" dataKey="totalIncome" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// GET /reports/debtor-students exists on the backend and was already
// implemented, but no page consumed it — this was flagged in Phase 0.
// Filtering/pagination below is presentation-only (client-side, over the
// already-fetched `debtors` list) — the API call itself is unchanged.
function DebtorStudentsPanel() {
  const debtorsQuery = useDebtorStudents();
  const debtors = debtorsQuery.data ?? [];
  const loading = debtorsQuery.isLoading;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return debtors;
    return debtors.filter((d) => d.studentFullName.includes(q));
  }, [debtors, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleExport() {
    exportToExcel(
      'بدهکاران',
      'دانش‌آموزان بدهکار',
      debtors.map((d) => ({ دانش‌آموز: d.studentFullName, 'مانده بدهی (تومان)': d.outstandingBalance })),
    );
  }

  const columns: TableColumn<DebtorStudent>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (d) => (
        <Link to={`/students/${d.studentId}`} className="font-medium text-action hover:underline">
          {d.studentFullName}
        </Link>
      ),
    },
    {
      key: 'balance',
      header: 'مانده بدهی',
      align: 'left',
      cellClassName: 'tabular font-semibold text-overdue',
      render: (d) => formatToman(d.outstandingBalance),
    },
  ];

  return (
    <Card title="دانش‌آموزان بدهکار" className="mt-4">
      <FilterBar
        actions={
          <Button variant="secondary" size="sm" onClick={handleExport}>
            خروجی Excel
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="جستجو با نام دانش‌آموز..."
          containerClassName="w-56 sm:w-64"
        />
      </FilterBar>

      <Table
        columns={columns}
        data={pageItems}
        rowKey={(d) => d.studentId}
        loading={loading}
        skeletonRows={4}
        emptyMessage={debtors.length === 0 ? 'هیچ دانش‌آموز بدهکاری وجود ندارد.' : 'نتیجه‌ای برای این جستجو یافت نشد.'}
      />

      {!loading && filtered.length > 0 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
    </Card>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="text-sm text-ink/60">{label}</div>
      <div className={`tabular mt-2 text-xl font-bold ${accent ? 'text-overdue' : 'text-ink'}`}>{value}</div>
    </div>
  );
}
