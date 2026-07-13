// Sprint 2A: Teacher Assignments (school_admin-only admin page).
//
// Manages teacher_assignments rows (which teacher teaches which
// grade+subject) via the existing backend routes on teacher.api.ts —
// POST/GET/DELETE /teacher/assignments. This is a distinct surface from
// the teacher-facing /teacher/* portal built in Sprint 1; it lives under
// the main admin app shell, same as SettingsPage/UsersPage.
//
// Sprint 2B: the two Sprint 2A limitations noted here previously are
// resolved —
// - TeacherAssignmentView now also carries teacherName/gradeTitle/
//   subjectTitle (backend: teacher-view.dto.ts), so the table shows real
//   names instead of raw ids.
// - GET /teacher/list (school_admin-only) now gives this page a proper
//   teacher roster, so the Teacher field below is a Select like Grade,
//   not a free-typed UUID input. Subject already had a resolvable
//   reference list on the backend (GET /subjects) that this page simply
//   wasn't using yet — it's wired up the same way as Grade/useGrades.

import { useMemo, useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { Table, type TableColumn } from '../components/Table';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError } from '../components/FormError';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { formatDate } from '../lib/format';
import { useGrades } from '../hooks/useStudents';
import { useSubjects } from '../hooks/useSubjects';
import {
  useTeacherAssignments,
  useCreateTeacherAssignment,
  useDeleteTeacherAssignment,
  useTeacherList,
} from '../hooks/useTeacher';
import type { TeacherAssignmentView } from '../api/teacher.api';

export function TeacherAssignmentsPage() {
  const { showSuccess, showError } = useToast();

  const assignmentsQuery = useTeacherAssignments();
  const gradesQuery = useGrades();
  const subjectsQuery = useSubjects();
  const teachersQuery = useTeacherList();
  const createAssignment = useCreateTeacherAssignment();
  const deleteAssignment = useDeleteTeacherAssignment();

  const assignments = assignmentsQuery.data ?? [];
  const grades = gradesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];
  const loading = assignmentsQuery.isLoading;
  const isError = assignmentsQuery.isError;

  const gradeTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grades) map.set(g.id, g.title);
    return map;
  }, [grades]);

  const subjectTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) map.set(s.id, s.title);
    return map;
  }, [subjects]);

  const teacherNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) map.set(t.id, t.fullName);
    return map;
  }, [teachers]);

  const [showForm, setShowForm] = useState(false);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherAssignmentView | null>(null);

  function handleCreate(dto: { teacherId: string; gradeId: string; subjectId: string }) {
    setCreateError(null);
    createAssignment.mutate(dto, {
      onSuccess: () => {
        setShowForm(false);
        showSuccess('تخصیص با موفقیت ثبت شد');
      },
      onError: (err) => {
        setCreateError(parseApiError(err));
        showError(getErrorMessage(err));
      },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteAssignment.mutate(deleteTarget.id, {
      onSuccess: () => {
        showSuccess('تخصیص حذف شد');
        setDeleteTarget(null);
      },
      onError: (err) => {
        showError(getErrorMessage(err));
        setDeleteTarget(null);
      },
    });
  }

  const columns: TableColumn<TeacherAssignmentView>[] = [
    {
      key: 'teacherId',
      header: 'معلم',
      render: (a) => a.teacherName ?? teacherNameById.get(a.teacherId) ?? a.teacherId,
    },
    {
      key: 'grade',
      header: 'پایه',
      render: (a) => a.gradeTitle ?? gradeTitleById.get(a.gradeId) ?? a.gradeId,
    },
    {
      key: 'subjectId',
      header: 'درس',
      render: (a) => a.subjectTitle ?? subjectTitleById.get(a.subjectId) ?? a.subjectId,
    },
    {
      key: 'createdAt',
      header: 'تاریخ ثبت',
      cellClassName: 'text-ink/60 dark:text-paper/60',
      render: (a) => formatDate(a.createdAt),
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (a) => (
        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(a)}>
          حذف
        </Button>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="تخصیص معلمان"
        description="مدیریت تخصیص معلمان به پایه‌ها و دروس"
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'انصراف' : '+ تخصیص جدید'}
          </Button>
        }
      />

      {showForm && (
        <CreateAssignmentForm
          teachers={teachers}
          grades={grades}
          subjects={subjects}
          saving={createAssignment.isPending}
          error={createError}
          onSubmit={handleCreate}
        />
      )}

      <Card className="mt-6">
        {isError ? (
          <EmptyState
            message="خطا در بارگذاری تخصیص‌ها"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => assignmentsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={assignments}
            rowKey={(a) => a.id}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هنوز تخصیصی ثبت نشده است."
            emptyDescription="برای شروع، از دکمه «تخصیص جدید» استفاده کنید."
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف تخصیص"
        description="آیا از حذف این تخصیص معلم مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        confirmLabel="حذف"
        variant="danger"
        loading={deleteAssignment.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function CreateAssignmentForm({
  teachers,
  grades,
  subjects,
  saving,
  error,
  onSubmit,
}: {
  teachers: { id: string; fullName: string }[];
  grades: { id: string; title: string }[];
  subjects: { id: string; title: string }[];
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (dto: { teacherId: string; gradeId: string; subjectId: string }) => void;
}) {
  const [teacherId, setTeacherId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ teacherId, gradeId, subjectId });
  }

  return (
    <Card title="ثبت تخصیص جدید" className="mb-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select
          required
          label="معلم"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="انتخاب معلم"
          options={teachers.map((t) => ({ value: t.id, label: t.fullName }))}
          helperText={teachers.length === 0 ? 'هیچ معلمی در این مدرسه ثبت نشده است.' : undefined}
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
          helperText={subjects.length === 0 ? 'هیچ درسی ثبت نشده است.' : undefined}
        />

        <div className="col-span-full">
          <FormError error={error} />
          <Button type="submit" loading={saving}>
            {saving ? 'در حال ذخیره...' : 'ثبت تخصیص'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
