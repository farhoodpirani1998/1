import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { KPICard } from '../components/KPICard';
import { Table, type TableColumn } from '../components/Table';
import { SkeletonCards, SkeletonRows } from '../components/Skeleton';
import { formatToman, formatDate, toPersianDigits } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useOverdueSummary, useDebtorStudents, useMonthlyIncome } from '../hooks/useReports';
import { usePayments } from '../hooks/usePayments';
import type { DebtorStudent } from '../types/report.types';
import type { PaymentWithContext, PaymentMethod } from '../types/payment.types';

// There is no single backend endpoint for "total tuition / paid /
// remaining across the whole school" — it's derived here from what IS
// available: summing DebtorStudent.outstandingBalance (remaining) and
// the current month's MonthlyIncome (paid this month). This is an
// approximation for the home page; the exact per-student figures still
// live on each student's own statement page.
//
// NOTE: /reports/overdue-summary, /reports/monthly-income and
// /reports/debtor-students are all @Roles('school_admin', 'accountant')
// on the backend — a `staff` user would get 403 on every one of these.
// Staff still land on this page (see Sidebar), so they get a simpler
// view below instead of three failed requests.
export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'staff') {
    return <StaffDashboard />;
  }
  return <FinancialDashboard />;
}

function StaffDashboard() {
  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" />
      <Card title="شروع سریع">
        <p className="mb-4 text-sm text-ink/70 dark:text-paper/70">
          گزارش‌های مالی برای نقش شما در دسترس نیست. از اینجا می‌توانید دانش‌آموزان را مدیریت کنید.
        </p>
        <Link to="/students" className="btn-primary inline-flex">
          مشاهده دانش‌آموزان
        </Link>
      </Card>
    </div>
  );
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  card_to_card: 'کارت‌به‌کارت',
  cheque: 'چک',
};

function FinancialDashboard() {
  const now = new Date();
  const summaryQuery = useOverdueSummary();
  const debtorsQuery = useDebtorStudents();
  const incomeQuery = useMonthlyIncome(now.getFullYear(), now.getMonth() + 1);
  // GET /payments (no studentId filter) already exists on the backend and
  // was already wired up in usePayments() — just not consumed by any page
  // yet (see hooks/usePayments.ts). Reused here, unmodified, for a
  // school-wide "recent activity" feed instead of adding a new endpoint.
  const paymentsQuery = usePayments();

  const summary = summaryQuery.data ?? null;
  const debtors = debtorsQuery.data ?? [];
  const monthIncome = incomeQuery.data ?? null;
  const recentPayments = paymentsQuery.data ?? [];
  const loading =
    summaryQuery.isLoading || debtorsQuery.isLoading || incomeQuery.isLoading || paymentsQuery.isLoading;
  const error = summaryQuery.isError || debtorsQuery.isError || incomeQuery.isError || paymentsQuery.isError;

  const totalOutstanding = debtors.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const paidThisMonth = monthIncome?.totalIncome ?? 0;
  const totalDue = totalOutstanding + paidThisMonth;
  // Presentational only — how much of this month's total due has already
  // been collected. Derived entirely from the two numbers above, no new
  // request or stored value.
  const collectionRate = totalDue > 0 ? (paidThisMonth / totalDue) * 100 : 0;

  const pieData = [
    { name: 'پرداخت‌شده (این ماه)', value: paidThisMonth, color: '#059669' },
    { name: 'باقی‌مانده', value: totalOutstanding, color: '#DC2626' },
  ];

  const topDebtors = [...debtors].sort((a, b) => b.outstandingBalance - a.outstandingBalance).slice(0, 5);
  const latestPayments = [...recentPayments]
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, 5);

  const debtorColumns: TableColumn<DebtorStudent>[] = [
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
      cellClassName: 'tabular font-medium text-overdue',
      render: (d) => formatToman(d.outstandingBalance),
    },
  ];

  const activityColumns: TableColumn<PaymentWithContext>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (p) => {
        const student = p.installment.tuitionPlan?.student;
        return student ? (
          <Link to={`/students/${student.id}`} className="font-medium text-action hover:underline">
            {student.fullName}
          </Link>
        ) : (
          <span className="text-ink/40">—</span>
        );
      },
    },
    {
      key: 'method',
      header: 'روش پرداخت',
      render: (p) => (p.paymentMethod ? paymentMethodLabels[p.paymentMethod] : '—'),
    },
    {
      key: 'date',
      header: 'تاریخ',
      render: (p) => formatDate(p.paidAt),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (p) => formatToman(p.amount),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" description="نمای کلی وضعیت مالی مدرسه" />

      {error && (
        <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">
          خطا در بارگذاری اطلاعات داشبورد
        </div>
      )}

      {/* Statistics cards */}
      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="جمع شهریه (تخمینی)" value={formatToman(totalDue)} icon={<TuitionIcon />} />
          <StatCard
            label="پرداخت‌شده این ماه"
            value={formatToman(paidThisMonth)}
            accent="paid"
            icon={<CheckIcon />}
          />
          <StatCard
            label="باقی‌مانده کل"
            value={formatToman(totalOutstanding)}
            accent="overdue"
            icon={<AlertIcon />}
          />
        </div>
      )}

      {/* KPI + Payment Summary */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {loading ? (
            <Card>
              <div className="skeleton mb-3 h-4 w-28" />
              <div className="skeleton mb-4 h-8 w-20" />
              <div className="skeleton h-1.5 w-full" />
            </Card>
          ) : (
            <KPICard
              label="نرخ وصول این ماه"
              value={`${toPersianDigits(Math.round(collectionRate))}٪`}
              icon={<TargetIcon />}
              accent="action"
              progress={collectionRate}
              subtitle={`از ${formatToman(totalDue)} شهریه این ماه`}
            />
          )}
        </div>

        <Card title="خلاصه پرداخت‌ها" className="lg:col-span-2">
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            {loading ? (
              <SkeletonRows rows={3} cols={1} />
            ) : (
              <div dir="ltr" className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatToman(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div dir="rtl" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] text-ink/45 dark:text-paper/45">جمع کل</span>
                  <span className="tabular text-sm font-bold text-ink dark:text-paper">{formatToman(totalDue)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <LegendRow color="bg-paid" label="پرداخت‌شده (این ماه)" value={loading ? '—' : formatToman(paidThisMonth)} />
              <LegendRow color="bg-overdue" label="باقی‌مانده" value={loading ? '—' : formatToman(totalOutstanding)} />
            </div>
          </div>
        </Card>
      </div>

      {/* Analytics cards — overdue breakdown */}
      <div className="mt-6">
        <SectionHeader
          title="اقساط معوق"
          action={
            <Link to="/reports" className="text-xs font-medium text-action hover:underline">
              مشاهده گزارش کامل ←
            </Link>
          }
        />
        {loading ? (
          <SkeletonCards count={3} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="تعداد اقساط معوق"
              value={summary ? toPersianDigits(summary.overdueInstallmentCount) : '—'}
              icon={<ListIcon />}
            />
            <StatCard
              label="دانش‌آموزان بدهکار"
              value={summary ? toPersianDigits(summary.overdueStudentCount) : '—'}
              icon={<UsersIcon />}
            />
            <StatCard
              label="مبلغ معوق"
              value={summary ? formatToman(summary.totalOverdueAmount) : '—'}
              accent="overdue"
              icon={<AlertIcon />}
            />
          </div>
        )}
      </div>

      {/* Debtor students + recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="دانش‌آموزان بدهکار (بیشترین مانده)">
          <Table
            columns={debtorColumns}
            data={topDebtors}
            rowKey={(d) => d.studentId}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هیچ دانش‌آموز بدهکاری وجود ندارد."
          />
          {debtors.length > 5 && (
            <Link to="/reports" className="mt-3 inline-block text-xs font-medium text-action hover:underline">
              مشاهده همه {toPersianDigits(debtors.length)} مورد ←
            </Link>
          )}
        </Card>

        <Card title="آخرین فعالیت‌ها (پرداخت‌ها)">
          <Table
            columns={activityColumns}
            data={latestPayments}
            rowKey={(p) => p.id}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هنوز پرداختی ثبت نشده است."
          />
        </Card>
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5 dark:bg-white/5">
      <span className="flex items-center gap-2 text-sm text-ink/70 dark:text-paper/70">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        {label}
      </span>
      <span className="tabular text-sm font-semibold text-ink dark:text-paper">{value}</span>
    </div>
  );
}

function TuitionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M8 15h3" />
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

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
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

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
