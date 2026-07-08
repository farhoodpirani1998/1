import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../components/Card';
import { SkeletonCards, SkeletonRows } from '../components/Skeleton';
import { formatToman, toPersianDigits } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useOverdueSummary, useDebtorStudents, useMonthlyIncome } from '../hooks/useReports';

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
      <h1 className="mb-6 text-xl font-bold text-ink">داشبورد</h1>
      <Card title="شروع سریع">
        <p className="mb-4 text-sm text-ink/70">
          گزارش‌های مالی برای نقش شما در دسترس نیست. از اینجا می‌توانید دانش‌آموزان را مدیریت کنید.
        </p>
        <Link to="/students" className="inline-block rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          مشاهده دانش‌آموزان
        </Link>
      </Card>
    </div>
  );
}

function FinancialDashboard() {
  const now = new Date();
  const summaryQuery = useOverdueSummary();
  const debtorsQuery = useDebtorStudents();
  const incomeQuery = useMonthlyIncome(now.getFullYear(), now.getMonth() + 1);

  const summary = summaryQuery.data ?? null;
  const debtors = debtorsQuery.data ?? [];
  const monthIncome = incomeQuery.data ?? null;
  const loading = summaryQuery.isLoading || debtorsQuery.isLoading || incomeQuery.isLoading;
  const error = summaryQuery.isError || debtorsQuery.isError || incomeQuery.isError;

  const totalOutstanding = debtors.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const paidThisMonth = monthIncome?.totalIncome ?? 0;
  const totalDue = totalOutstanding + paidThisMonth;

  const pieData = [
    { name: 'پرداخت‌شده (این ماه)', value: paidThisMonth, color: '#F5C244' },
    { name: 'باقی‌مانده', value: totalOutstanding, color: '#0F1E3D' },
  ];

  return (
    <div className="fade-in">
      <h1 className="mb-6 text-xl font-bold text-ink">داشبورد</h1>

      {error && <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">خطا در بارگذاری اطلاعات داشبورد</div>}

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="جمع شهریه (تخمینی)" value={formatToman(totalDue)} />
          <StatCard label="پرداخت‌شده این ماه" value={formatToman(paidThisMonth)} accent="paid" />
          <StatCard label="باقی‌مانده کل" value={formatToman(totalOutstanding)} accent="overdue" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="وضعیت کل پرداخت‌ها" className="lg:col-span-1">
          {loading ? (
            <SkeletonRows rows={3} cols={1} />
          ) : (
            <div dir="ltr" className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatToman(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 flex justify-center gap-4 text-xs text-ink/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" /> پرداخت‌شده
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-navy" /> باقی‌مانده
            </span>
          </div>
        </Card>

        <Card title="اقساط معوق" className="lg:col-span-2">
          {loading ? (
            <SkeletonRows rows={2} cols={3} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="تعداد اقساط معوق" value={summary ? toPersianDigits(summary.overdueInstallmentCount) : '—'} plain />
              <StatCard label="دانش‌آموزان بدهکار" value={summary ? toPersianDigits(summary.overdueStudentCount) : '—'} plain />
              <StatCard label="مبلغ معوق" value={summary ? formatToman(summary.totalOverdueAmount) : '—'} accent="overdue" plain />
            </div>
          )}
          <Link to="/reports" className="mt-4 inline-block text-xs font-medium text-action hover:underline">
            مشاهده گزارش کامل ←
          </Link>
        </Card>
      </div>

      <Card title="دانش‌آموزان بدهکار (بیشترین مانده)" className="mt-6">
        {loading ? (
          <SkeletonRows rows={5} cols={2} />
        ) : debtors.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink/50">هیچ دانش‌آموز بدهکاری وجود ندارد.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-right text-ink/50">
                <th className="py-2 font-medium">دانش‌آموز</th>
                <th className="py-2 font-medium">مانده بدهی</th>
              </tr>
            </thead>
            <tbody>
              {[...debtors]
                .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
                .slice(0, 5)
                .map((d) => (
                  <tr key={d.studentId} className="border-b border-line/60 last:border-0">
                    <td className="py-2">
                      <Link to={`/students/${d.studentId}`} className="text-action hover:underline">
                        {d.studentFullName}
                      </Link>
                    </td>
                    <td className="tabular py-2 font-medium text-overdue">{formatToman(d.outstandingBalance)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {debtors.length > 5 && (
          <Link to="/reports" className="mt-3 inline-block text-xs font-medium text-action hover:underline">
            مشاهده همه {toPersianDigits(debtors.length)} مورد ←
          </Link>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  plain = false,
}: {
  label: string;
  value: string;
  accent?: 'paid' | 'overdue';
  plain?: boolean;
}) {
  const colorClass = accent ? { paid: 'text-paid', overdue: 'text-overdue' }[accent] : 'text-ink';
  return (
    <div
      className={
        plain
          ? 'rounded-lg bg-paper p-4'
          : 'ledger-lines rounded-xl border border-line bg-white p-5 shadow-card'
      }
    >
      <div className="text-sm text-ink/60">{label}</div>
      <div className={`tabular mt-2 text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}
