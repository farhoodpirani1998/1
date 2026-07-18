import { useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { StatCard } from '../../components/StatCard';
import { KPICard } from '../../components/KPICard';
import { Table, type TableColumn } from '../../components/Table';
import { SkeletonCards, SkeletonRows } from '../../components/Skeleton';
import { formatToman, formatDate, toPersianDigits, paymentMethodLabels } from '../../lib/format';
import { useFounderSchoolDashboard } from '../../hooks/useFounder';
import type {
  FounderStudentAverage,
  FounderRecentPayment,
  FounderRecentAssessment,
} from '../../types/founder.types';

const persianMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export function FounderSchoolDashboardPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const dashboardQuery = useFounderSchoolDashboard(schoolId);
  const data = dashboardQuery.data;
  const loading = dashboardQuery.isLoading;
  const error = dashboardQuery.isError;

  const students = data?.students ?? null;
  const finance = data?.finance ?? null;
  const attendance = data?.attendance ?? null;
  const assessments = data?.assessments ?? null;
  const recentActivity = data?.recentActivity ?? null;
  const averageScore = assessments?.averageScore;
  const averageScoreText = averageScore == null ? 'داده‌ای موجود نیست' : toPersianDigits(averageScore.toFixed(1));

  const paymentTrendPoints = (data?.charts.monthlyPayments ?? []).map((p) => ({
    ...p,
    label: `${persianMonthNames[p.month - 1]} ${toPersianDigits(p.year)}`,
  }));
  const registrationPoints = (data?.charts.monthlyRegistrations ?? []).map((p) => ({
    ...p,
    label: `${persianMonthNames[p.month - 1]} ${toPersianDigits(p.year)}`,
  }));

  const topStudentColumns: TableColumn<FounderStudentAverage>[] = [
    { key: 'name', header: 'دانش‌آموز', render: (s) => s.studentFullName },
    {
      key: 'average',
      header: 'میانگین',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (s) => toPersianDigits(s.average.toFixed(1)),
    },
  ];

  const lowestStudentColumns: TableColumn<FounderStudentAverage>[] = [
    { key: 'name', header: 'دانش‌آموز', render: (s) => s.studentFullName },
    {
      key: 'average',
      header: 'میانگین',
      align: 'left',
      cellClassName: 'tabular font-medium text-overdue',
      render: (s) => toPersianDigits(s.average.toFixed(1)),
    },
  ];

  const paymentColumns: TableColumn<FounderRecentPayment>[] = [
    { key: 'student', header: 'دانش‌آموز', render: (p) => p.studentFullName },
    {
      key: 'amount',
      header: 'مبلغ',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (p) => formatToman(p.amount),
    },
    {
      key: 'method',
      header: 'روش',
      cellClassName: 'text-ink/60 dark:text-paper/60',
      render: (p) => (p.paymentMethod ? paymentMethodLabels[p.paymentMethod as keyof typeof paymentMethodLabels] ?? p.paymentMethod : '—'),
    },
    { key: 'date', header: 'تاریخ', cellClassName: 'tabular text-ink/60 dark:text-paper/60', render: (p) => formatDate(p.paidAt) },
  ];

  const assessmentColumns: TableColumn<FounderRecentAssessment>[] = [
    { key: 'student', header: 'دانش‌آموز', render: (a) => a.studentFullName },
    { key: 'subject', header: 'درس', cellClassName: 'text-ink/60 dark:text-paper/60', render: (a) => a.subjectTitle ?? '—' },
    {
      key: 'score',
      header: 'نمره',
      align: 'left',
      cellClassName: 'tabular font-medium',
      render: (a) => `${toPersianDigits(a.score)} / ${toPersianDigits(a.maxScore)}`,
    },
  ];

  if (error) {
    return (
      <div className="rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">خطا در بارگذاری داشبورد مدرسه</div>
    );
  }

  return (
    <div>
      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="دانش‌آموزان (فعال)" value={`${toPersianDigits(students?.active ?? 0)} از ${toPersianDigits(students?.total ?? 0)}`} icon={<StudentsIcon />} />
          <StatCard label="جمع شهریه" value={formatToman(finance?.totalTuition ?? 0)} icon={<TuitionIcon />} />
          <StatCard label="پرداخت‌شده" value={formatToman(finance?.totalPaid ?? 0)} accent="paid" icon={<CheckIcon />} />
          <StatCard label="مبلغ معوق" value={formatToman(finance?.overdueAmount ?? 0)} accent="overdue" icon={<AlertIcon />} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <>
            <KPICard
              label="نرخ حضور امروز"
              value={`${toPersianDigits((attendance?.attendanceRate ?? 0).toFixed(1))}٪`}
              icon={<AttendanceIcon />}
              accent="paid"
              progress={attendance?.attendanceRate}
              subtitle={`${toPersianDigits(attendance?.presentToday ?? 0)} حاضر / ${toPersianDigits(attendance?.absentToday ?? 0)} غایب / ${toPersianDigits(attendance?.lateToday ?? 0)} تأخیر`}
            />
            <KPICard
              label="میانگین ارزیابی‌ها"
              value={averageScoreText}
              icon={<ScoreIcon />}
              accent="action"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="روند پرداخت‌ها">
          {loading ? (
            <SkeletonRows rows={3} cols={4} />
          ) : paymentTrendPoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/50 dark:text-paper/50">داده‌ای برای نمایش وجود ندارد.</p>
          ) : (
            <div dir="ltr" className="h-56">
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

        <Card title="ثبت‌نام‌های ماهانه">
          {loading ? (
            <SkeletonRows rows={3} cols={4} />
          ) : registrationPoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/50 dark:text-paper/50">داده‌ای برای نمایش وجود ندارد.</p>
          ) : (
            <div dir="ltr" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={registrationPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={12} tickFormatter={(v) => toPersianDigits(String(v))} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => toPersianDigits(value)} />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <SectionHeader title="ارزیابی‌ها" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="برترین دانش‌آموزان">
            <Table
              columns={topStudentColumns}
              data={assessments?.topStudents ?? []}
              rowKey={(s) => s.studentId}
              loading={loading}
              skeletonRows={4}
              emptyMessage="داده‌ای موجود نیست."
            />
          </Card>
          <Card title="نیازمند پیگیری">
            <Table
              columns={lowestStudentColumns}
              data={assessments?.lowestStudents ?? []}
              rowKey={(s) => s.studentId}
              loading={loading}
              skeletonRows={4}
              emptyMessage="داده‌ای موجود نیست."
            />
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="آخرین پرداخت‌ها"
          action={
            <Link to={`/founder/schools/${schoolId}/tuition`} className="text-xs font-medium text-action hover:underline">
              مشاهده شهریه ←
            </Link>
          }
        >
          <Table
            columns={paymentColumns}
            data={recentActivity?.payments ?? []}
            rowKey={(p) => p.id}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هنوز پرداختی ثبت نشده است."
          />
        </Card>

        <Card title="آخرین ارزیابی‌ها">
          <Table
            columns={assessmentColumns}
            data={recentActivity?.assessments ?? []}
            rowKey={(a) => a.id}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هنوز ارزیابی‌ای ثبت نشده است."
          />
        </Card>
      </div>

      {!loading && (recentActivity?.announcements.length ?? 0) > 0 && (
        <Card title="آخرین اطلاعیه‌ها" className="mt-6">
          <ul className="divide-y divide-line dark:divide-white/10">
            {recentActivity!.announcements.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink dark:text-paper">{a.title}</span>
                <span className="tabular shrink-0 text-xs text-ink/45 dark:text-paper/45">{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
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

function StudentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function AttendanceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4m-8 7 2 2 4-4" />
    </svg>
  );
}

function ScoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}
