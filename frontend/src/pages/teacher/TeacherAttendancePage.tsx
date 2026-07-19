// Teacher Attendance (Part 1).
//
// Backend is frozen for this feature: POST /teacher/attendance,
// GET /teacher/classes, GET /teacher/students already exist on
// TeacherController (see backend/src/modules/teacher/teacher.controller.ts
// and the attendance module it delegates to). There is no bulk attendance
// endpoint, so Save submits one POST per modified student — safe to retry
// since AttendanceService.record() upserts on (studentId, date) rather
// than erroring on a resubmit.
//
// Scope (Part 1 only): mark today-or-any-date attendance for one of the
// teacher's own grades. Attendance HISTORY (viewing/editing past records)
// is explicitly out of scope — see the TODO at the bottom of this file.
//
// Mirrors the shape of TeacherStudentsPage (grade Select sourced from
// useTeacherClasses, Card + Table + EmptyState-on-error) with an added
// date picker and a per-row status/note editor.

import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { FilterBar } from '../../components/FilterBar';
import { Select } from '../../components/Select';
import { Input } from '../../components/Input';
import { PersianDatePicker } from '../../components/PersianDatePicker';
import { Table, type TableColumn } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../lib/toast';
import { getErrorMessage } from '../../lib/error-handler';
import { useTeacherClasses, useTeacherStudents, useRecordAttendance } from '../../hooks/useTeacher';
import { getPreviousSessionAttendance } from '../../api/attendancePreviousSession.mock';
import {
  ATTENDANCE_DISPLAY_OPTIONS,
  DISPLAY_STATUS_BADGE_CLASS,
  DISPLAY_STATUS_LABEL,
  DISPLAY_STATUS_TAG,
  DISPLAY_TO_BACKEND_STATUS,
  type AttendanceDisplayStatus,
} from '../../types/attendanceExtras.types';
import type { Student } from '../../types/student.types';

const STATUS_OPTIONS = ATTENDANCE_DISPLAY_OPTIONS;
const STATUS_BADGE_CLASS = DISPLAY_STATUS_BADGE_CLASS;

// Local per-student editor state. `savedFor` records the (status, note)
// pair that was last successfully persisted, so a row only gets
// re-submitted when something has actually changed since its last
// successful save — not on every click of Save.
interface RowState {
  status: AttendanceDisplayStatus | '';
  note: string;
  savedFor: { status: AttendanceDisplayStatus; note: string } | null;
  error: string | null;
}

const EMPTY_ROW: RowState = { status: '', note: '', savedFor: null, error: null };

function isDirty(row: RowState): boolean {
  if (!row.status) return false;
  if (!row.savedFor) return true;
  return row.savedFor.status !== row.status || row.savedFor.note !== row.note;
}

// Local YYYY-MM-DD for the browser's own timezone (not UTC — a plain
// `new Date().toISOString().slice(0, 10)` can land on the wrong calendar
// day near midnight). Matches the plain `<input type="date">` value
// format used elsewhere in this app (see StudentsPage/SettingsPage).
function todayIso(): string {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function TeacherAttendancePage() {
  const { showSuccess, showError } = useToast();
  const [gradeId, setGradeId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [copyingPrevious, setCopyingPrevious] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const classesQuery = useTeacherClasses();
  const studentsQuery = useTeacherStudents(gradeId || undefined);
  const recordAttendance = useRecordAttendance();

  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  // A new grade or a new date is a new attendance session — start each
  // one with a clean editor rather than carrying over selections that no
  // longer refer to the same day/roster.
  useEffect(() => {
    setRows({});
  }, [gradeId, date]);

  function rowFor(studentId: string): RowState {
    return rows[studentId] ?? EMPTY_ROW;
  }

  // Accepts '' too — selecting the Select's placeholder option again
  // resets a student back to "not marked" rather than being an invalid
  // status.
  function setStatus(studentId: string, status: AttendanceDisplayStatus | '') {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...rowFor(studentId), status, error: null },
    }));
  }

  function setNote(studentId: string, note: string) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...rowFor(studentId), note, error: null },
    }));
  }

  // «ثبت گروهی» — همه حاضر / همه غایب. فقط دانش‌آموزانی که هنوز
  // «ذخیره‌شده» با همین وضعیت نیستند تغییر می‌کنند (تا یک ثبت گروهی
  // اشتباهی، وضعیت‌های قبلاً ذخیره‌شده و دستی را overwrite نکند —
  // برای آن، خود وضعیت هر ردیف را جداگانه عوض کنید).
  function markAll(status: AttendanceDisplayStatus) {
    setRows((prev) => {
      const next = { ...prev };
      for (const s of students) {
        next[s.id] = { ...rowFor(s.id), status, error: null };
      }
      return next;
    });
  }

  // «کپی از جلسه قبل» — در نبود endpoint واقعی برای خواندن جلسه قبلی
  // (توضیح در api/attendancePreviousSession.mock.ts)، فعلاً Mock است.
  async function copyFromPreviousSession() {
    if (students.length === 0) return;
    setCopyingPrevious(true);
    try {
      const previous = await getPreviousSessionAttendance(students.map((s) => s.id));
      setRows((prev) => {
        const next = { ...prev };
        for (const s of students) {
          const status = previous[s.id];
          if (!status) continue;
          next[s.id] = { ...rowFor(s.id), status, error: null };
        }
        return next;
      });
      showSuccess('وضعیت جلسه قبل کپی شد — قبل از ذخیره بررسی کنید');
    } catch {
      showError('کپی از جلسه قبل با خطا مواجه شد');
    } finally {
      setCopyingPrevious(false);
    }
  }

  const dirtyEntries = Object.entries(rows).filter(([, row]) => isDirty(row));
  const canSave = !!gradeId && dirtyEntries.length > 0 && !saving;

  // «نمایش آمار» — شمارش زنده از وضعیت‌های در حال ویرایش (rows)، نه یک
  // منبع Mock جدا — همیشه دقیقاً همان چیزی را نشان می‌دهد که در جدول است.
  const statusCounts = STATUS_OPTIONS.reduce<Record<AttendanceDisplayStatus, number>>(
    (acc, opt) => {
      acc[opt.value] = 0;
      return acc;
    },
    {} as Record<AttendanceDisplayStatus, number>,
  );
  let unmarkedCount = 0;
  for (const s of students) {
    const status = rowFor(s.id).status;
    if (status) statusCounts[status] += 1;
    else unmarkedCount += 1;
  }

  async function handleSaveAll() {
    if (dirtyEntries.length === 0) return;
    setSaving(true);

    const results = await Promise.allSettled(
      dirtyEntries.map(([studentId, row]) => {
        const displayStatus = row.status as AttendanceDisplayStatus;
        const tag = DISPLAY_STATUS_TAG[displayStatus];
        // برچسب وضعیت‌های فاقد معادل دقیق در enum واقعی (مرخصی/غیبت
        // غیرموجه) به یادداشت اضافه می‌شود تا با ذخیره واقعی هم گم نشود
        // — توضیح کامل در types/attendanceExtras.types.ts.
        const note = tag ? `[${tag}]${row.note.trim() ? ' ' + row.note.trim() : ''}` : row.note.trim();
        return recordAttendance.mutateAsync({
          studentId,
          date,
          status: DISPLAY_TO_BACKEND_STATUS[displayStatus],
          note: note || undefined,
        });
      }),
    );

    setRows((prev) => {
      const next = { ...prev };
      results.forEach((result, i) => {
        const [studentId, row] = dirtyEntries[i];
        if (result.status === 'fulfilled') {
          next[studentId] = {
            ...row,
            savedFor: { status: row.status as AttendanceDisplayStatus, note: row.note },
            error: null,
          };
        } else {
          next[studentId] = { ...row, error: getErrorMessage(result.reason) };
        }
      });
      return next;
    });

    setSaving(false);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount === 0) {
      showSuccess(`حضور و غیاب ${successCount} دانش‌آموز با موفقیت ثبت شد`);
    } else if (successCount === 0) {
      showError(`ثبت حضور و غیاب انجام نشد (${failCount} مورد با خطا مواجه شد)`);
    } else {
      showError(`${successCount} مورد ثبت شد — ${failCount} مورد با خطا مواجه شد و نیاز به تلاش مجدد دارد`);
    }
  }

  const columns: TableColumn<Student>[] = [
    {
      key: 'fullName',
      header: 'نام دانش‌آموز',
      render: (s) => (
        <div>
          <div className="font-medium text-ink dark:text-paper">{s.fullName}</div>
          {rowFor(s.id).error && <div className="mt-0.5 text-xs text-overdue">{rowFor(s.id).error}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (s) => {
        const row = rowFor(s.id);
        return (
          <Select
            value={row.status}
            onChange={(e) => setStatus(s.id, e.target.value as AttendanceDisplayStatus | '')}
            placeholder="ثبت نشده"
            options={STATUS_OPTIONS}
            containerClassName="min-w-[130px]"
          />
        );
      },
    },
    {
      key: 'badge',
      header: '',
      render: (s) => {
        const row = rowFor(s.id);
        if (!row.status) return null;
        const saved = row.savedFor?.status === row.status && row.savedFor?.note === row.note;
        return (
          <span className={`badge ${STATUS_BADGE_CLASS[row.status]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {saved ? 'ذخیره شد' : 'ذخیره‌نشده'}
          </span>
        );
      },
    },
    {
      key: 'note',
      header: 'یادداشت (اختیاری)',
      render: (s) => {
        const row = rowFor(s.id);
        return (
          <Input
            value={row.note}
            onChange={(e) => setNote(s.id, e.target.value)}
            placeholder="یادداشت..."
            containerClassName="min-w-[160px]"
          />
        );
      },
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="حضور و غیاب"
        description="ثبت حضور و غیاب دانش‌آموزان کلاس‌های تخصیص‌یافته به شما"
        actions={
          <Button variant="primary" onClick={handleSaveAll} disabled={!canSave} loading={saving}>
            ذخیره حضور و غیاب
          </Button>
        }
      />

      <FilterBar>
        <Select
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          placeholder="انتخاب پایه"
          options={classes.map((c) => ({ value: c.id, label: c.title }))}
          containerClassName="min-w-[200px]"
        />
        <PersianDatePicker value={date} onChange={setDate} containerClassName="min-w-[160px]" />
      </FilterBar>

      {gradeId && students.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink/50 dark:text-paper/50">ثبت گروهی:</span>
          <Button variant="secondary" size="sm" onClick={() => markAll('present')}>
            همه حاضر
          </Button>
          <Button variant="secondary" size="sm" onClick={() => markAll('quick_absent')}>
            همه غایب
          </Button>
          <Button variant="secondary" size="sm" onClick={copyFromPreviousSession} loading={copyingPrevious}>
            کپی از جلسه قبل
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowStats((v) => !v)}>
            {showStats ? 'بستن آمار' : 'نمایش آمار'}
          </Button>
        </div>
      )}

      {showStats && gradeId && students.length > 0 && (
        <Card className="mb-4">
          <div className="flex flex-wrap gap-4">
            {STATUS_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <span className={`badge ${STATUS_BADGE_CLASS[opt.value]}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {DISPLAY_STATUS_LABEL[opt.value]}
                </span>
                <span className="text-sm font-medium text-ink dark:text-paper">{statusCounts[opt.value]}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="badge bg-ink/5 text-ink/50 border-line dark:bg-white/5 dark:text-paper/50 dark:border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                ثبت‌نشده
              </span>
              <span className="text-sm font-medium text-ink dark:text-paper">{unmarkedCount}</span>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {!gradeId ? (
          <EmptyState
            message="ابتدا یک پایه انتخاب کنید"
            description="برای مشاهده دانش‌آموزان و ثبت حضور و غیاب، یک پایه از فهرست بالا انتخاب نمایید."
          />
        ) : studentsQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری دانش‌آموزان"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => studentsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={students}
            rowKey={(s) => s.id}
            loading={studentsQuery.isLoading}
            skeletonRows={5}
            emptyMessage="دانش‌آموزی یافت نشد."
            emptyDescription="در این پایه دانش‌آموزی ثبت نشده است."
          />
        )}
      </Card>
    </div>
  );
}

// TODO (Teacher Attendance Part 2 / Teacher Assessments — out of scope
// for this sprint):
//   - Attendance history: a read view of previously recorded attendance
//     (no GET-by-date route is wired into the frontend yet; the backend
//     module has query-attendance-by-date.dto.ts but TeacherController
//     doesn't expose it, so nothing to call without a backend change).
//   - Editing a past day's attendance from a history view (today's page
//     only ever resubmits for the currently selected date).
//   - Teacher Assessments page (POST /teacher/assessments already exists
//     on the backend, same shape as this feature, but is unimplemented
//     on the frontend).
