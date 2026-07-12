import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { KPICard } from '../components/KPICard';
import { Table, type TableColumn } from '../components/Table';
import { SkeletonCards, SkeletonRows } from '../components/Skeleton';
import { formatToman, formatDate, toPersianDigits, paymentMethodLabels } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useOverdueSummary, useDebtorStudents, useMonthlyIncome, useMonthlyIncomeTrend } from '../hooks/useReports';
import { useStudents } from '../hooks/useStudents';
import { usePayments } from '../hooks/usePayments';
import { useDashboard } from '../hooks/useAnalytics';
import type { DebtorStudent } from '../types/report.types';
import type { PaymentWithContext } from '../types/payment.types';
import type { DashboardStudentAverage } from '../types/analytics.types';

// Persian calendar month names for x-axis labels — same list ReportsPage's
// IncomeTrendPanel already defines locally; kept as its own local copy
// here rather than a shared constant, matching this codebase's existing
// convention of small per-page duplication over new shared abstractions
// (see StatCard's own doc comment for the same rationale).
const persianMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

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
  // school_admin gets the analytics-backed dashboard (GET
  // /analytics/dashboard, @Roles('school_admin') only on the backend).
  // accountant keeps FinancialDashboard exactly as before — the analytics
  // endpoint would 403 for that role.
  if (user?.role === 'school_admin') {
    return <SchoolAdminDashboard />;
  }
  return <FinancialDashboard />;
}

// Staff can't hit any /reports/* endpoint (school_admin/accountant only —
// see the note on DashboardPage above), so nothing here is a financial
// number. Everything below is derived client-side from GET /students,
// which staff IS allowed to call (@Roles('school_admin','accountant',
// 'staff') on StudentsController#findWithFilters) — same list StudentsPage
// already fetches, just summarized differently. No new endpoint.
function StaffDashboard() {
  const studentsQuery = useStudents();
  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isLoading;

  const today = new Date();
  const isSameDay = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };
  const isSameMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  };

  const activeCount = students.filter((s) => s.status === 'active').length;
  // enrollmentDate is the only real signal for "registered today/this
  // month" (see student.types.ts) — students without it are simply
  // excluded, not counted as 0.
  const registeredToday = students.filter((s) => s.enrollmentDate && isSameDay(s.enrollmentDate)).length;
  const registeredThisMonth = students.filter((s) => s.enrollmentDate && isSameMonth(s.enrollmentDate)).length;

  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" description="خلاصه امروز و دسترسی سریع به کارهای روزمره" />

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="دانش‌آموزان فعال" value={toPersianDigits(activeCount)} accent="paid" />
          <StatCard label="ثبت‌نام امروز" value={toPersianDigits(registeredToday)} accent="action" />
          <StatCard label="ثبت‌نام این ماه" value={toPersianDigits(registeredThisMonth)} accent="warning" />
        </div>
      )}

      <Card title="شروع سریع" className="mt-6">
        <p className="mb-4 text-sm text-ink/70 dark:text-paper/70">
          گزارش‌های مالی برای نقش شما در دسترس نیست. از اینجا می‌توانید دانش‌آموزان را مدیریت کنید.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Reuses StudentsPage's existing create-student form — this just
              tells that page to open it automatically instead of duplicating
              the form here. */}
          <Link to="/students" state={{ openCreateForm: true }} className="btn-primary justify-center">
            + ثبت‌نام دانش‌آموز جدید
          </Link>
          <Link to="/students" className="btn-secondary justify-center">
            مشاهده دانش‌آموزان
          </Link>
          <Link to="/students/archived" className="btn-secondary justify-center">
            دانش‌آموزان غیرفعال
          </Link>
        </div>
      </Card>
    </div>
  );
}

// school_admin dashboard, backed by the single GET /analytics/dashboard
// call (useDashboard()). Unlike FinancialDashboard below, the finance
// totals here are exact (totalTuition/totalPaid/totalUnpaid/overdueAmount
// come straight from the endpoint), plus attendance and assessments
// summaries and a real monthly-payments trend — none of which existed on
// the dashboard before. accountant/staff never render this component.
function SchoolAdminDashboard() {
  const dashboardQuery = useDashboard();
  const data = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;
  const error = dashboardQuery.isError;

  const finance = data?.finance ?? null;
  const attendance = data?.attendance ?? null;
  const assessments = data?.assessments ?? null;
  const monthlyPayments = data?.charts.monthlyPayments ?? [];

  const paymentTrendPoints = monthlyPayments.map((p) => ({
    ...p,
    label: `${persianMonthNames[p.month - 1]} ${p.year}`,
  }));

  const topStudentColumns: TableColumn<DashboardStudentAverage>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (s) => (
        <Link to={`/students/${s.studentId}`} className="font-medium text-action hover:underline">
          {s.studentFullName}
        </Link>
      ),
    },
    {
      key: 'average',
      header: 'میانگین',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (s) => toPersianDigits(s.average.toFixed(1)),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" description="نمای کلی وضعیت مدرسه" />

      {error && (
        <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">
          خطا در بارگذاری اطلاعات داشبورد
        </div>
      )}

      {/* Finance summary — exact school-wide totals, no approximation */}
      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="جمع شهریه" value={formatToman(finance?.totalTuition ?? 0)} icon={<TuitionIcon />} />
          <StatCard
            label="پرداخت‌شده"
            value={formatToman(finance?.totalPaid ?? 0)}
            accent="paid"
            icon={<CheckIcon />}
          />
          <StatCard
            label="پرداخت‌نشده"
            value={formatToman(finance?.totalUnpaid ?? 0)}
            accent="warning"
            icon={<ListIcon />}
          />
          <StatCard
            label="مبلغ معوق"
            value={formatToman(finance?.overdueAmount ?? 0)}
            accent="overdue"
            icon={<AlertIcon />}
          />
        </div>
      )}

      {/* Attendance summary + Assessments summary */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="خلاصه حضور و غیاب امروز">
          {loading ? (
            <SkeletonRows rows={3} cols={1} />
          ) : (
            <div className="flex flex-col gap-4">
              <KPICard
                label="نرخ حضور کلی"
                value={`${toPersianDigits(Math.round(attendance?.attendanceRate ?? 0))}٪`}
                icon={<TargetIcon />}
                accent="action"
                progress={attendance?.attendanceRate ?? 0}
              />
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  plain
                  label="حاضر امروز"
                  value={toPersianDigits(attendance?.presentToday ?? 0)}
                  accent="paid"
                />
                <StatCard
                  plain
                  label="غایب امروز"
                  value={toPersianDigits(attendance?.absentToday ?? 0)}
                  accent="overdue"
                />
                <StatCard
                  plain
                  label="تأخیر امروز"
                  value={toPersianDigits(attendance?.lateToday ?? 0)}
                  accent="warning"
                />
              </div>
            </div>
          )}
        </Card>

        <Card
          title="خلاصه ارزیابی‌ها"
          action={
            <Link to="/students" className="text-xs font-medium text-action hover:underline">
              مشاهده دانش‌آموزان ←
            </Link>
          }
        >
          {loading ? (
            <SkeletonRows rows={5} cols={2} />
          ) : (
            <>
              <div className="mb-4 rounded-lg bg-paper px-4 py-3 dark:bg-white/5">
                <div className="text-sm text-ink/60 dark:text-paper/60">میانگین کل مدرسه</div>
                <div className="tabular mt-1 text-xl font-bold text-ink dark:text-paper">
                  {assessments?.averageScore != null ? toPersianDigits(assessments.averageScore.toFixed(1)) : '—'}
                </div>
              </div>
              <Table
                columns={topStudentColumns}
                data={assessments?.topStudents ?? []}
                rowKey={(s) => s.studentId}
                emptyMessage="هنوز ارزیابی‌ای ثبت نشده است."
              />
            </>
          )}
        </Card>
      </div>

      {/* Monthly payments trend */}
      <div className="mt-6">
        <SectionHeader title="روند پرداخت‌های ماهانه" />
        <Card>
          {loading ? (
            <SkeletonRows rows={3} cols={4} />
          ) : (
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paymentTrendPoints}>
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
      </div>
    </div>
  );
}

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

      <FinancialTrendPanel />

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

// Same technique ReportsPage's IncomeTrendPanel already uses: the backend
// only exposes GET /reports/monthly-income?year&month (one aggregate per
// call, no series endpoint — see report.types.ts), so the trend is built
// by calling it once per month via the existing useMonthlyIncomeTrend
// hook. No new endpoint, no "target" line — there's no backend concept of
// a target to compare against, so this only adds a previous-month delta,
// which is derivable from the same six data points already being fetched.
function FinancialTrendPanel() {
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

  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const hasComparison = !loading && !!current && !!previous && previous.totalIncome > 0;
  const changePct = hasComparison ? ((current.totalIncome - previous.totalIncome) / previous.totalIncome) * 100 : null;

  return (
    <Card
      title="روند درآمد (۶ ماه اخیر)"
      className="mt-6"
      action={
        changePct !== null ? (
          <span
            className={`tabular text-xs font-semibold ${changePct >= 0 ? 'text-paid' : 'text-overdue'}`}
            title="نسبت به ماه قبل"
          >
            {changePct >= 0 ? '▲' : '▼'} {toPersianDigits(Math.abs(Math.round(changePct)))}٪ نسبت به ماه قبل
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonRows rows={3} cols={4} />
      ) : (
        <div dir="ltr" className="h-56">
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
