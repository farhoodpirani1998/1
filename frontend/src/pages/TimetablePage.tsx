// Sprint 2 (Educational Operations): weekly class schedule definition
// ("تعریف برنامه هفتگی کلاس"). Backend: TimetableController
// (POST/GET/PUT/DELETE /timetable, @Roles('school_admin')) — see
// backend/src/modules/timetable/timetable.controller.ts. The
// teacher-facing (/teacher/timetable) and parent-facing
// (/parent/students/:id/timetable) reads are read-only views of the
// same rows this page manages; there was previously no admin-facing UI
// for it at all (see TeacherTimetablePage.tsx's note).
//
// weekday follows the backend's Weekday enum (0 = Saturday ... 6 =
// Friday, the Iranian school week) — same convention
// TeacherTimetablePage already uses.

import { useMemo, useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { Table, type TableColumn } from '../components/Table';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Input } from '../components/Input';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError } from '../components/FormError';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, type ParsedApiError } from '../lib/error-handler';
import { useGrades, useAcademicYears } from '../hooks/useStudents';
import { useSubjects } from '../hooks/useSubjects';
import { useTeacherList } from '../hooks/useTeacher';
import {
  useAdminTimetable,
  useCreateTimetableEntry,
  useUpdateTimetableEntry,
  useDeleteTimetableEntry,
} from '../hooks/useTimetable';
import type { TimetableEntry, CreateTimetableEntryInput } from '../api/timetable.api';

const WEEKDAY_LABELS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

type EntryFormValues = {
  academicYearId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string;
};

export function TimetablePage() {
  const { showSuccess, showError } = useToast();

  const [gradeFilter, setGradeFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const entriesQuery = useAdminTimetable({
    ...(gradeFilter ? { gradeId: gradeFilter } : {}),
    ...(teacherFilter ? { teacherId: teacherFilter } : {}),
  });
  const gradesQuery = useGrades();
  const subjectsQuery = useSubjects();
  const teachersQuery = useTeacherList();
  const academicYearsQuery = useAcademicYears();

  const createEntry = useCreateTimetableEntry();
  const updateEntry = useUpdateTimetableEntry();
  const deleteEntry = useDeleteTimetableEntry();

  const entries = entriesQuery.data ?? [];
  const grades = gradesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];
  const academicYears = academicYearsQuery.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [formError, setFormError] = useState<ParsedApiError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimetableEntry | null>(null);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    [entries],
  );

  function openCreateForm() {
    setEditingEntry(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(entry: TimetableEntry) {
    setEditingEntry(entry);
    setFormError(null);
    setShowForm(true);
  }

  function handleSubmit(values: EntryFormValues) {
    setFormError(null);
    const dto: CreateTimetableEntryInput = {
      academicYearId: values.academicYearId,
      gradeId: values.gradeId,
      subjectId: values.subjectId,
      teacherId: values.teacherId,
      weekday: values.weekday,
      startTime: values.startTime,
      endTime: values.endTime,
      room: values.room || undefined,
    };

    const onSettled = {
      onSuccess: () => {
        showSuccess(editingEntry ? 'برنامه به‌روزرسانی شد' : 'برنامه جدید ثبت شد');
        setShowForm(false);
        setEditingEntry(null);
      },
      onError: (err: unknown) => {
        setFormError(parseApiError(err));
        showError(getErrorMessage(err));
      },
    };

    if (editingEntry) {
      updateEntry.mutate({ id: editingEntry.id, dto }, onSettled);
    } else {
      createEntry.mutate(dto, onSettled);
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteEntry.mutate(deleteTarget.id, {
      onSuccess: () => {
        showSuccess('برنامه حذف شد');
        setDeleteTarget(null);
      },
      onError: (err) => {
        showError(getErrorMessage(err));
        setDeleteTarget(null);
      },
    });
  }

  const columns: TableColumn<TimetableEntry>[] = [
    { key: 'weekday', header: 'روز', render: (e) => WEEKDAY_LABELS[e.weekday] ?? e.weekday },
    {
      key: 'time',
      header: 'ساعت',
      cellClassName: 'tabular',
      render: (e) => `${e.startTime} – ${e.endTime}`,
    },
    { key: 'grade', header: 'پایه', render: (e) => e.gradeTitle ?? e.gradeId },
    { key: 'subject', header: 'درس', render: (e) => e.subjectTitle ?? e.subjectId },
    { key: 'teacher', header: 'معلم', render: (e) => e.teacherName ?? e.teacherId },
    { key: 'room', header: 'کلاس', render: (e) => e.room ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (e) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditForm(e)}>
            ویرایش
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(e)}>
            حذف
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="برنامه هفتگی کلاس‌ها"
        description="تعریف و مدیریت برنامه هفتگی کلاس‌های مدرسه"
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => (showForm ? setShowForm(false) : openCreateForm())}>
            {showForm ? 'انصراف' : '+ افزودن برنامه'}
          </Button>
        }
      />

      {showForm && (
        <EntryForm
          key={editingEntry?.id ?? 'new'}
          initial={editingEntry}
          grades={grades}
          subjects={subjects}
          teachers={teachers}
          academicYears={academicYears}
          saving={createEntry.isPending || updateEntry.isPending}
          error={formError}
          onSubmit={handleSubmit}
        />
      )}

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            placeholder="همه پایه‌ها"
            options={grades.map((g) => ({ value: g.id, label: g.title }))}
            containerClassName="w-44"
          />
          <Select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            placeholder="همه معلمان"
            options={teachers.map((t) => ({ value: t.id, label: t.fullName }))}
            containerClassName="w-44"
          />
        </div>

        {entriesQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری برنامه هفتگی"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => entriesQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={sortedEntries}
            rowKey={(e) => e.id}
            loading={entriesQuery.isLoading}
            emptyMessage="هنوز برنامه‌ای تعریف نشده است."
            emptyDescription="برای شروع، از دکمه «افزودن برنامه» استفاده کنید."
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف برنامه"
        description="آیا از حذف این جلسه از برنامه هفتگی مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        confirmLabel="حذف"
        variant="danger"
        loading={deleteEntry.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function EntryForm({
  initial,
  grades,
  subjects,
  teachers,
  academicYears,
  saving,
  error,
  onSubmit,
}: {
  initial: TimetableEntry | null;
  grades: { id: string; title: string }[];
  subjects: { id: string; title: string }[];
  teachers: { id: string; fullName: string }[];
  academicYears: { id: string; title: string; isCurrent?: boolean }[];
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (values: EntryFormValues) => void;
}) {
  const currentYear = academicYears.find((y) => y.isCurrent) ?? academicYears[0];

  const [academicYearId, setAcademicYearId] = useState(initial?.academicYearId ?? currentYear?.id ?? '');
  const [gradeId, setGradeId] = useState(initial?.gradeId ?? '');
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '');
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? '');
  const [weekday, setWeekday] = useState(String(initial?.weekday ?? 0));
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [room, setRoom] = useState(initial?.room ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      academicYearId,
      gradeId,
      subjectId,
      teacherId,
      weekday: Number(weekday),
      startTime,
      endTime,
      room,
    });
  }

  return (
    <Card title={initial ? 'ویرایش برنامه' : 'افزودن جلسه جدید'} className="mb-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          required
          label="سال تحصیلی"
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
          placeholder="انتخاب سال تحصیلی"
          options={academicYears.map((y) => ({ value: y.id, label: y.title }))}
        />
        <Select
          required
          label="پایه تحصیلی"
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          placeholder="انتخاب پایه"
          options={grades.map((g) => ({ value: g.id, label: g.title }))}
        />
        <Select
          required
          label="درس"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="انتخاب درس"
          options={subjects.map((s) => ({ value: s.id, label: s.title }))}
        />
        <Select
          required
          label="معلم"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="انتخاب معلم"
          options={teachers.map((t) => ({ value: t.id, label: t.fullName }))}
        />
        <Select
          required
          label="روز هفته"
          value={weekday}
          onChange={(e) => setWeekday(e.target.value)}
          options={WEEKDAY_LABELS.map((label, i) => ({ value: String(i), label }))}
        />
        <Input required label="ساعت شروع" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input required label="ساعت پایان" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <Input label="شماره کلاس" value={room} onChange={(e) => setRoom(e.target.value)} />

        <div className="col-span-full">
          <FormError error={error} />
          <Button type="submit" loading={saving}>
            {saving ? 'در حال ذخیره...' : initial ? 'ذخیره تغییرات' : 'ثبت برنامه'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
