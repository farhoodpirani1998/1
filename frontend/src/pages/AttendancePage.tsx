// Sprint 2 (Educational Operations): whole-school attendance view by
// date ("مشاهده حضور و غیاب کل مدرسه بر اساس تاریخ"). Backend:
// AttendanceController's GET /attendance/date/:date
// (@Roles('school_admin', 'accountant', 'staff')) — see
// backend/src/modules/attendance/attendance.controller.ts. Distinct from
// TeacherAttendancePage (a teacher marking their own class); this is a
// read-first roster across every grade for one calendar day, with the
// same correction capability (a second POST /attendance for the same
// student+date) available inline for a front-desk correction.

import { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PersianDatePicker } from '../components/PersianDatePicker';
import { Select } from '../components/Select';
import { Table, type TableColumn } from '../components/Table';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { useToast } from '../lib/toast';
import { getErrorMessage } from '../lib/error-handler';
import { useGrades } from '../hooks/useStudents';
import { useAttendanceByDate, useRecordAttendanceAdmin } from '../hooks/useAttendance';
import { todayJalali, jalaliToIso } from '../lib/jalali';
import type { AttendanceRecord, AttendanceStatus } from '../api/attendance.api';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'حاضر' },
  { value: 'absent', label: 'غایب' },
  { value: 'late', label: 'تأخیر' },
  { value: 'excused', label: 'موجه' },
];

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

export function AttendancePage() {
  const { showSuccess, showError } = useToast();

  const [date, setDate] = useState<string>(() => {
    const today = todayJalali();
    return jalaliToIso(today.jy, today.jm, today.jd);
  });
  const [gradeId, setGradeId] = useState('');
  // studentId of the row currently being corrected inline, or null.
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const gradesQuery = useGrades();
  const attendanceQuery = useAttendanceByDate(date, gradeId ? { gradeId } : undefined);
  const recordAttendance = useRecordAttendanceAdmin();

  const grades = gradesQuery.data ?? [];
  const records = attendanceQuery.data ?? [];

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of records) counts[r.status] += 1;
    return counts;
  }, [records]);

  function handleCorrect(record: AttendanceRecord, status: AttendanceStatus) {
    recordAttendance.mutate(
      { studentId: record.studentId, date, status },
      {
        onSuccess: () => {
          showSuccess('حضور و غیاب اصلاح شد');
          setEditingStudentId(null);
        },
        onError: (err) => showError(getErrorMessage(err)),
      },
    );
  }

  const columns: TableColumn<AttendanceRecord>[] = [
    { key: 'studentName', header: 'دانش‌آموز', render: (r) => r.studentName ?? r.studentId },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) =>
        editingStudentId === r.studentId ? (
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleCorrect(r, opt.value)}
                disabled={recordAttendance.isPending}
                className={`badge ${STATUS_BADGE_CLASS[opt.value]} ${
                  opt.value === r.status ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <span className={`badge ${STATUS_BADGE_CLASS[r.status]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {STATUS_LABEL[r.status]}
          </span>
        ),
    },
    { key: 'note', header: 'یادداشت', cellClassName: 'text-ink/60 dark:text-paper/60', render: (r) => r.note ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEditingStudentId(editingStudentId === r.studentId ? null : r.studentId)}
        >
          {editingStudentId === r.studentId ? 'بستن' : 'اصلاح'}
        </Button>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="حضور و غیاب کل مدرسه" description="مشاهده وضعیت حضور و غیاب همه دانش‌آموزان در یک روز" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <PersianDatePicker label="تاریخ" value={date} onChange={setDate} containerClassName="w-48" />
        <Select
          label="پایه تحصیلی"
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          placeholder="همه پایه‌ها"
          options={grades.map((g) => ({ value: g.id, label: g.title }))}
          containerClassName="w-48"
        />
      </div>

      {!attendanceQuery.isLoading && !attendanceQuery.isError && records.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="حاضر" value={String(summary.present)} />
          <StatCard label="غایب" value={String(summary.absent)} />
          <StatCard label="تأخیر" value={String(summary.late)} />
          <StatCard label="موجه" value={String(summary.excused)} />
        </div>
      )}

      <Card>
        {attendanceQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری حضور و غیاب"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => attendanceQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={records}
            rowKey={(r) => r.id}
            loading={attendanceQuery.isLoading}
            emptyMessage="برای این روز حضور و غیابی ثبت نشده است."
            emptyDescription="حضور و غیاب توسط معلمان از پنل خودشان ثبت می‌شود."
          />
        )}
      </Card>
    </div>
  );
}
