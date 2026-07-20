import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards } from '../../components/Skeleton';
import { Table, type TableColumn } from '../../components/Table';
import { AttendanceIcon } from '../../components/icons/SchoolIcons';
import { formatDate, toPersianDigits } from '../../lib/format';
import { useStudentAttendance } from '../../hooks/useStudentPortal';
import type { AttendanceStatus, ParentAttendanceView } from '../../types/parent.types';

// Task 5B-B — /student/attendance. The signed-in student's own attendance
// history, backed by GET /student/attendance (useStudentAttendance) only —
// no other query, no direct API call, no duplicated state/business logic.
//
// Design reference: ParentAttendancePage (/parent/attendance) is the
// closest sibling — same read-only "stat row + records table" shape,
// same ParentAttendanceView rows (the backend reuses that exact view for
// the student's own reads; see types/studentPortal.types.ts) and the same
// STATUS_LABEL/STATUS_BADGE_CLASS pair StudentDashboardPage already
// defines locally for its own recent-attendance list. There's no
// StudentSwitcher here (unlike Parent) since a student portal session is
// always exactly one student — that's the only structural difference
// from ParentAttendancePage.
//
// Loading/empty/error states follow the Teacher Portal convention (see
// TeacherAttendancePage's studentsQuery handling): an explicit
// EmptyState + "تلاش مجدد" retry action on error, SkeletonCards while the
// stat row has no data yet, and Table's own built-in empty state for a
// genuinely empty record set.

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غایب',
  late: 'تأخیر',
  excused: 'موجه',
};

const STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
  present: 'bg-paid/10 text-paid border-paid/25',
  absent: 'bg-overdue/10 text-overdue border-overdue/25',
  late: 'bg-action-soft text-action border-action/25',
  excused: 'bg-ink/5 text-ink/60 border-line dark:bg-white/5 dark:text-paper/60 dark:border-white/10',
};

export function StudentAttendancePage() {
  const attendanceQuery = useStudentAttendance();

  if (attendanceQuery.isLoading) {
    return (
      <div className="fade-in">
        <PageHeader title="حضور و غیاب" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (attendanceQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="حضور و غیاب" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری حضور و غیاب"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => attendanceQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const records = [...(attendanceQuery.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const presentCount = records.filter((r) => r.status === 'present').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const lateCount = records.filter((r) => r.status === 'late').length;

  const columns: TableColumn<ParentAttendanceView>[] = [
    {
      key: 'date',
      header: 'تاریخ',
      render: (r) => formatDate(r.date),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <span className={`badge ${STATUS_BADGE_CLASS[r.status]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'یادداشت',
      render: (r) => r.note ?? '—',
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="حضور و غیاب" description="سوابق حضور و غیاب شما" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="حاضر" value={toPersianDigits(presentCount)} accent="paid" />
        <StatCard label="غایب" value={toPersianDigits(absentCount)} accent={absentCount > 0 ? 'overdue' : 'default'} />
        <StatCard label="تأخیر" value={toPersianDigits(lateCount)} accent={lateCount > 0 ? 'warning' : 'default'} />
      </div>

      <div className="mt-6">
        <Card title="سوابق حضور و غیاب">
          <Table
            columns={columns}
            data={records}
            rowKey={(r) => r.id}
            emptyMessage="سابقه‌ای برای نمایش وجود ندارد."
            emptyIcon={<AttendanceIcon size={28} />}
          />
        </Card>
      </div>
    </div>
  );
}
