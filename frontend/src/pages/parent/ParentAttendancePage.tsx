import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { Table, type TableColumn } from '../../components/Table';
import { formatDate, toPersianDigits } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentAttendance } from '../../hooks/useParent';
import type { AttendanceStatus, ParentAttendanceView } from '../../types/parent.types';

// /parent/attendance — attendance history for the selected child. Backed
// by GET /parent/students/:id/attendance, which already existed
// server-side (AttendanceService.findForParent, ownership-checked the
// same way as tuition/installments/payments) but had no frontend
// consumer until now.

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

export function ParentAttendancePage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const attendanceQuery = useStudentAttendance(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="حضور و غیاب" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="حضور و غیاب" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
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
      <PageHeader
        title="حضور و غیاب"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

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
            loading={attendanceQuery.isLoading}
            emptyMessage="سابقه‌ای برای این دانش‌آموز ثبت نشده است."
          />
        </Card>
      </div>
    </div>
  );
}
