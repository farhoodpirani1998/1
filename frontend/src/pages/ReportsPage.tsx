import { useMemo, useState } from 'react';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { DensityToggle, type TableDensity } from '../components/DensityToggle';
import { StatCard } from '../components/StatCard';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { Table, type TableColumn } from '../components/Table';
import { Pagination, paginate } from '../components/Pagination';
import { Button } from '../components/Button';
import { SkeletonRows, SkeletonCards } from '../components/Skeleton';
import { formatToman, toPersianDigits } from '../lib/format';
import { exportToExcel } from '../lib/exportExcel';
import { EmptyState } from '../components/EmptyState';
import { ReportsIcon, AlertIcon } from '../components/icons/SchoolIcons';
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
  const topError = summaryQuery.isError || installmentsQuery.isError;
  // Sprint A5.2 (task 3) — the two distribution charts below are derived
  // from the full installments list; when that list is genuinely empty
  // (no installments exist anywhere yet) every bar would render at zero
  // height, which explains nothing to the admin. Same real data, just a
  // clearer presentation of "nothing here yet" than an empty-looking chart.
  const hasInstallments = (installmentsQuery.data?.length ?? 0) > 0;

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

  function retryTopSection() {
    summaryQuery.refetch();
    installmentsQuery.refetch();
  }

  return (
    <div className="fade-in">
      <WorkspaceHeader
        title="گزارش‌ها"
        subtitle="نمای کلی وضعیت مالی، بدهکاران و روند درآمد"
        countLabel={
          summaryQuery.isLoading ? '…' : summaryQuery.isError ? '—' : `${toPersianDigits(summary?.overdueStudentCount ?? 0)} دانش‌آموز بدهکار`
        }
        countIcon={<ReportsIcon size={12} />}
        countAriaLabel="تعداد دانش‌آموزان بدهکار"
      />

      {topError ? (
        <div role="alert" className="mb-6">
          <Card>
            <EmptyState
              icon={<AlertIcon size={28} />}
              message="خطا در بارگذاری گزارش‌ها"
              description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
              action={
                <Button variant="secondary" size="sm" onClick={retryTopSection}>
                  تلاش مجدد
                </Button>
              }
            />
          </Card>
        </div>
      ) : loading ? (
        <div className="mb-6">
          <SkeletonCards count={3} />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="اقساط معوق" value={summary ? toPersianDigits(summary.overdueInstallmentCount) : '—'} />
          <StatCard label="دانش‌آموزان بدهکار" value={summary ? toPersianDigits(summary.overdueStudentCount) : '—'} />
          <StatCard
            label="جمع مبلغ معوق"
            value={summary ? formatToman(summary.totalOverdueAmount) : '—'}
            accent="overdue"
          />
        </div>
      )}

      <IncomeTrendPanel />
      <DebtorStudentsPanel />

      {topError ? null : loading ? (
        <>
          <Card className="mt-6">
            <div className="flex h-64 flex-col justify-center">
              <SkeletonRows rows={4} cols={3} />
            </div>
          </Card>
          <Card className="mt-6">
            <div className="flex h-64 flex-col justify-center">
              <SkeletonRows rows={4} cols={3} />
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card title="توزیع اقساط بر اساس وضعیت (تعداد)" className="mt-6">
            {hasInstallments ? (
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
            ) : (
              <EmptyState
                message="هنوز قسطی ثبت نشده است"
                description="با ثبت اولین قسط، توزیع وضعیت اقساط اینجا نمایش داده می‌شود."
              />
            )}
          </Card>

          <Card title="مبلغ باقیمانده بر اساس وضعیت (تومان)" className="mt-6">
            {hasInstallments ? (
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
            ) : (
              <EmptyState
                message="هنوز قسطی ثبت نشده است"
                description="با ثبت اولین قسط، مبلغ باقیمانده به تفکیک وضعیت اینجا نمایش داده می‌شود."
              />
            )}
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
  const error = results.some((r) => r.isError);
  const points = results.map((r, i) => ({
    ...(r.data ?? { year: months[i].year, month: months[i].month, totalIncome: 0, paymentCount: 0 }),
    label: `${persianMonthNames[months[i].month - 1]} ${months[i].year}`,
  }));

  const total = points.reduce((sum, p) => sum + p.totalIncome, 0);

  function retryTrend() {
    results.forEach((r) => r.refetch());
  }

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
      className="mt-6"
      action={
        loading || error ? undefined : (
          <div className="flex items-center gap-3">
            <div className="text-sm text-ink/60 dark:text-paper/60">
              جمع ۶ ماه: <span className="tabular font-bold text-paid">{formatToman(total)}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              خروجی Excel
            </Button>
          </div>
        )
      }
    >
      {error ? (
        <div role="alert">
          <EmptyState
            icon={<AlertIcon size={28} />}
            message="خطا در بارگذاری روند درآمد"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={retryTrend}>
                تلاش مجدد
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <div className="flex h-64 flex-col justify-center">
          <SkeletonRows rows={3} cols={4} />
        </div>
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
  const error = debtorsQuery.isError;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Sprint A5.1 (task 3) — the same presentation-only compact/comfortable
  // switch the Student/Teacher/Installments Workspaces already expose next
  // to their tables; Table already supported this prop before this page
  // had a control for it. No query, filter, sort, or export logic here.
  const [density, setDensity] = useState<TableDensity>('comfortable');

  const isFiltered = Boolean(search.trim());

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

  function clearSearch() {
    setSearch('');
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
    <Card title="دانش‌آموزان بدهکار" className="mt-6">
      {/* Sprint A5.1 (task 2) — same "Search | view controls + workspace
          actions" grouping as the Installments Workspace's toolbar: the
          existing search box (only real filter on this panel) on one
          side, the new DensityToggle and the existing Excel export
          together on the other — no new controls introduced. */}
      <div className="mb-4 flex flex-col border-b border-line pb-4 dark:border-white/10">
        <FilterBar
          actions={
            <>
              <DensityToggle value={density} onChange={setDensity} />
              <span className="hidden h-6 w-px bg-line dark:bg-white/10 sm:inline-block" aria-hidden="true" />
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={loading || error}>
                خروجی Excel
              </Button>
            </>
          }
        >
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            onClear={clearSearch}
            placeholder="جستجو با نام دانش‌آموز..."
            containerClassName="w-full sm:w-64"
          />
          {/* Sprint A5.2 (task 4) — same aria-live result-count convention
              already used on the Teacher Workspace's toolbar, so a
              screen-reader user hears the match count update as they
              type instead of only sighted users seeing the table change. */}
          <span className="text-xs font-medium text-ink/45 dark:text-paper/45" aria-live="polite">
            {loading || error ? '' : `${toPersianDigits(filtered.length)} دانش‌آموز`}
          </span>
        </FilterBar>
      </div>

      {/* Sprint A5.2 (task 1) — same AlertIcon + retry convention already
          used on the Installments Workspace; retry reuses this query's own
          refetch, no new request type. Toolbar above stays usable during
          an error so the search box isn't blocked. */}
      {error ? (
        <div role="alert">
          <EmptyState
            icon={<AlertIcon size={28} />}
            message="خطا در بارگذاری دانش‌آموزان بدهکار"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => debtorsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </div>
      ) : (
        <Table
          density={density}
          columns={columns}
          data={pageItems}
          rowKey={(d) => d.studentId}
          loading={loading}
          skeletonRows={4}
          emptyMessage={debtors.length === 0 ? 'هیچ دانش‌آموز بدهکاری وجود ندارد.' : 'نتیجه‌ای برای این جستجو یافت نشد.'}
          emptyDescription={
            debtors.length === 0
              ? 'همه‌ی اقساط تاکنون به‌موقع یا زودتر پرداخت شده‌اند.'
              : 'عبارت جستجو را بررسی کنید یا آن را پاک کنید.'
          }
          emptyAction={
            isFiltered && filtered.length === 0 ? (
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                پاک کردن جستجو
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="mt-4 border-t border-line pt-4 text-center dark:border-white/10">
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </Card>
  );
}

