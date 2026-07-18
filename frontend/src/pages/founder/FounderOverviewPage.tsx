import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { KPICard } from '../../components/KPICard';
import { Card } from '../../components/Card';
import { Table, type TableColumn } from '../../components/Table';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { formatToman, toPersianDigits } from '../../lib/format';
import { useFounderOverview } from '../../hooks/useFounder';
import type { FounderOverviewSchool } from '../../types/founder.types';

// Presentation-only badge, same visual language as the shared
// <StatusBadge/> (which is typed for InstallmentStatus, not a school's
// active/inactive flag) — same pattern as UsersPage's local
// UserStatusBadge.
function SchoolStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

// The founder's landing page after login (see HomeRedirect) — aggregated
// totals across every owned school (GET /founder/overview), independent
// of the school switcher used on the per-school pages (see
// founder-frontend-prompt.md §2.2).
export function FounderOverviewPage() {
  const overviewQuery = useFounderOverview();
  const data = overviewQuery.data;
  const loading = overviewQuery.isLoading;
  const error = overviewQuery.isError;

  const totals = data?.totals;
  const schools = data?.schools ?? [];

  const columns: TableColumn<FounderOverviewSchool>[] = [
    {
      key: 'name',
      header: 'مدرسه',
      render: (s) => (
        <Link to={`/founder/schools/${s.schoolId}`} className="font-medium text-action hover:underline">
          {s.schoolName}
        </Link>
      ),
    },
    { key: 'status', header: 'وضعیت', render: (s) => <SchoolStatusBadge isActive={s.isActive} /> },
    {
      key: 'students',
      header: 'دانش‌آموزان',
      align: 'left',
      cellClassName: 'tabular',
      render: (s) => toPersianDigits(s.studentCount),
    },
    {
      key: 'teachers',
      header: 'معلم‌ها',
      align: 'left',
      cellClassName: 'tabular',
      render: (s) => toPersianDigits(s.teacherCount),
    },
    {
      key: 'staff',
      header: 'کارمندان',
      align: 'left',
      cellClassName: 'tabular',
      render: (s) => toPersianDigits(s.staffCount),
    },
    {
      key: 'paid',
      header: 'دریافتی',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (s) => formatToman(s.totalPaid),
    },
    {
      key: 'unpaid',
      header: 'باقی‌مانده',
      align: 'left',
      cellClassName: 'tabular font-medium text-warning',
      render: (s) => formatToman(s.totalUnpaid),
    },
    {
      key: 'overdue',
      header: 'معوق',
      align: 'left',
      cellClassName: 'tabular font-medium text-overdue',
      render: (s) => formatToman(s.overdueAmount),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="نمای کلی" description="خلاصه‌ی تجمیعی همه‌ی مدرسه‌های تحت مالکیت شما" />

      {error && (
        <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">
          خطا در بارگذاری اطلاعات نمای کلی
        </div>
      )}

      {loading ? (
        <SkeletonCards count={4} />
      ) : schools.length === 0 && !error ? (
        <Card>
          <EmptyState
            message="هنوز به هیچ مدرسه‌ای متصل نشده‌اید"
            description="وقتی مدیر سامانه یک یا چند مدرسه را به حساب شما متصل کند، اطلاعات آن‌ها اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="تعداد مدرسه‌ها"
              value={toPersianDigits(totals?.schoolCount ?? 0)}
              icon={<SchoolIcon />}
              accent="action"
            />
            <KPICard
              label="کل دانش‌آموزان"
              value={toPersianDigits(totals?.studentCount ?? 0)}
              icon={<StudentsIcon />}
              accent="paid"
            />
            <KPICard
              label="معلم‌ها و کارمندان"
              value={toPersianDigits((totals?.teacherCount ?? 0) + (totals?.staffCount ?? 0))}
              icon={<UsersIcon />}
              accent="action"
            />
            <KPICard
              label="مبلغ معوق"
              value={formatToman(totals?.overdueAmount ?? 0)}
              icon={<AlertIcon />}
              accent="overdue"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <div className="text-sm text-ink/60 dark:text-paper/60">کل شهریه</div>
              <div className="tabular mt-2 text-xl font-bold text-ink dark:text-paper">
                {formatToman(totals?.totalTuition ?? 0)}
              </div>
            </Card>
            <Card>
              <div className="text-sm text-ink/60 dark:text-paper/60">دریافت‌شده</div>
              <div className="tabular mt-2 text-xl font-bold text-paid">{formatToman(totals?.totalPaid ?? 0)}</div>
            </Card>
            <Card>
              <div className="text-sm text-ink/60 dark:text-paper/60">باقی‌مانده</div>
              <div className="tabular mt-2 text-xl font-bold text-warning">
                {formatToman(totals?.totalUnpaid ?? 0)}
              </div>
            </Card>
          </div>

          <Card title="مدرسه‌ها" className="mt-6">
            <Table columns={columns} data={schools} rowKey={(s) => s.schoolId} />
          </Card>
        </>
      )}
    </div>
  );
}

function SchoolIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6" />
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

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}
