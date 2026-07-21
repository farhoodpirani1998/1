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
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { FilterBar } from '../components/FilterBar';
import { DensityToggle, type TableDensity } from '../components/DensityToggle';
import { Table, type TableColumn } from '../components/Table';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError } from '../components/FormError';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { formatDate, toPersianDigits } from '../lib/format';
import { useGrades, useClasses, useAcademicYears } from '../hooks/useStudents';
import { useSubjects } from '../hooks/useSubjects';
import { AlertIcon, TeacherIcon } from '../components/icons/SchoolIcons';
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
  const academicYearsQuery = useAcademicYears();
  const createAssignment = useCreateTeacherAssignment();
  const deleteAssignment = useDeleteTeacherAssignment();

  const assignments = assignmentsQuery.data ?? [];
  const grades = gradesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];
  const academicYears = academicYearsQuery.data ?? [];
  const loading = assignmentsQuery.isLoading;
  const isError = assignmentsQuery.isError;

  // TeacherAssignment itself carries no academicYearId (see the entity
  // on the backend) -- assignments are implicitly "for the current
  // year", the same assumption every other year-less admin surface in
  // this app already makes. Classes are picked from the current year's
  // sections accordingly.
  const currentAcademicYearId = academicYears.find((y) => y.isCurrent)?.id;
  const classesQuery = useClasses(
    currentAcademicYearId ? { academicYearId: currentAcademicYearId } : undefined,
  );
  const classes = classesQuery.data ?? [];

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

  const classTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.title);
    return map;
  }, [classes]);

  const teacherNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) map.set(t.id, t.fullName);
    return map;
  }, [teachers]);

  const [showForm, setShowForm] = useState(false);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherAssignmentView | null>(null);
  // Sprint A3.1 — Workspace Toolbar "View controls", same presentational-
  // only density switch the Student Workspace uses (Table already
  // supports this prop; no query/filter/sort change of any kind).
  const [density, setDensity] = useState<TableDensity>('comfortable');

  function handleCreate(dto: { teacherId: string; gradeId: string; subjectId: string; classId: string }) {
    setCreateError(null);
    createAssignment.mutate(
      { ...dto, subjectId: dto.subjectId || undefined, classId: dto.classId || undefined },
      {
        onSuccess: () => {
          setShowForm(false);
          showSuccess('تخصیص با موفقیت ثبت شد');
        },
        onError: (err) => {
          setCreateError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
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
      key: 'classId',
      header: 'کلاس',
      render: (a) =>
        a.classTitle ?? (a.classId ? classTitleById.get(a.classId) ?? a.classId : 'کل پایه'),
    },
    {
      key: 'subjectId',
      header: 'درس',
      render: (a) =>
        a.subjectTitle ?? (a.subjectId ? subjectTitleById.get(a.subjectId) ?? a.subjectId : 'همه دروس'),
    },
    {
      key: 'createdAt',
      header: 'تاریخ ثبت',
      // Sprint A3.1 (task 6) — same "hide the least essential column below
      // sm" treatment the Student Workspace already applies to its
      // guardian column, to reduce crowding on small screens. Data is
      // unchanged and still visible at sm and up.
      headerClassName: 'hidden sm:table-cell',
      cellClassName: 'hidden sm:table-cell text-ink/60 dark:text-paper/60',
      render: (a) => formatDate(a.createdAt),
    },
    {
      key: 'actions',
      // Sprint A3.1 (task 4) — sr-only label so the blank header still
      // announces something to screen readers, same treatment already
      // applied to the Student Workspace's actions column. Row action
      // itself (the "حذف" button below) is untouched.
      header: <span className="sr-only">عملیات</span>,
      align: 'left',
      render: (a) => (
        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(a)}>
          حذف
        </Button>
      ),
    },
  ];

  const teacherCount = teachers.length;

  return (
    <div className="fade-in">
      {/* Sprint A3.1 (Teacher Workspace) — structured header via the same
          shared <WorkspaceHeader/> the Student Workspace uses (task 1).
          Count badge is the school's teacher roster size — already
          fetched via useTeacherList() for the create-form's picker below,
          so this is existing data, not a new query. There's no secondary,
          page-level action analogous to Students' "غیرفعال‌ها" link here
          (no archived-teachers view exists), so that slot is simply
          omitted rather than filled with a placeholder. */}
      <WorkspaceHeader
        title="تخصیص معلمان"
        subtitle="مدیریت تخصیص معلمان به پایه‌ها و دروس"
        countLabel={teachersQuery.isLoading ? '…' : `${toPersianDigits(teacherCount)} معلم`}
        countIcon={<TeacherIcon size={12} />}
        countAriaLabel="تعداد کل معلمان"
        primaryAction={
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
          currentAcademicYearId={currentAcademicYearId}
          saving={createAssignment.isPending}
          error={createError}
          onSubmit={handleCreate}
        />
      )}

      <Card className="mt-6">
        {/* Sprint A3.1 (task 2) — Workspace Toolbar. This page has no
            search box or filter controls today (GET /teacher/assignments
            takes only an optional teacherId no UI ever set — see
            useTeacherAssignments above), so per this sprint's "do not add
            new filters" constraint, the Search/Filters sections are left
            out entirely rather than filled with non-functional controls.
            Only the View controls section (density, identical to the
            Student Workspace's) has something real to show; Workspace
            actions live in the header above ("+ تخصیص جدید") rather than
            being duplicated here.
            Sprint A3.2 (task 6) — this row now renders through the shared
            <FilterBar/> instead of a hand-rolled div that duplicated its
            exact layout classes; the row count also shows a loading
            ellipsis (matching the header's own countLabel convention)
            and announces itself via aria-live so screen-reader users hear
            the updated count after a create/delete without a full re-read
            of the page. Purely presentational — no filter, sort, or query
            behavior is attached to this row. */}
        <FilterBar
          className="border-b border-line pb-4 dark:border-white/10"
          actions={<DensityToggle value={density} onChange={setDensity} />}
        >
          <span className="text-xs font-medium text-ink/45 dark:text-paper/45" aria-live="polite">
            {loading ? '…' : `${toPersianDigits(assignments.length)} تخصیص`}
          </span>
        </FilterBar>

        {/* Sprint A3.1 (task 5) — error state polished with the same
            AlertIcon + retry convention already used on the Student
            Workspace, instead of the generic default icon. Retry reuses
            the query's own existing refetch — no new request type. */}
        {isError ? (
          <EmptyState
            icon={<AlertIcon size={28} />}
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
            stickyHeader
            density={density}
            columns={columns}
            data={assignments}
            rowKey={(a) => a.id}
            loading={loading}
            skeletonRows={5}
            emptyIcon={<TeacherIcon size={28} />}
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
  currentAcademicYearId,
  saving,
  error,
  onSubmit,
}: {
  teachers: { id: string; fullName: string }[];
  grades: { id: string; title: string }[];
  subjects: { id: string; title: string }[];
  currentAcademicYearId?: string;
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (dto: { teacherId: string; gradeId: string; subjectId: string; classId: string }) => void;
}) {
  const [teacherId, setTeacherId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  // Sections of the selected grade, for the current academic year --
  // TeacherAssignment has no academicYearId of its own (see
  // TeacherAssignmentsPage's comment on currentAcademicYearId), so this
  // always picks from the current year's sections.
  const classesQuery = useClasses(
    gradeId && currentAcademicYearId ? { gradeId, academicYearId: currentAcademicYearId } : undefined,
  );
  const classes = classesQuery.data ?? [];

  function handleGradeChange(value: string) {
    setGradeId(value);
    setClassId(''); // a class from the previous grade no longer applies
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ teacherId, gradeId, subjectId, classId });
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
          onChange={(e) => handleGradeChange(e.target.value)}
          placeholder="انتخاب پایه"
          options={grades.map((g) => ({ value: g.id, label: g.title }))}
        />
        <Select
          label="کلاس"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          placeholder="کل پایه (همه کلاس‌ها)"
          disabled={!gradeId}
          options={classes.map((c) => ({ value: c.id, label: c.title }))}
          helperText={
            !gradeId
              ? 'ابتدا پایه را انتخاب کنید.'
              : classes.length === 0
                ? 'برای این پایه هنوز کلاسی ثبت نشده — معلم روی کل پایه تخصیص می‌گیرد.'
                : 'برای تخصیص روی یک بخش خاص از پایه (مثلاً هفتم-الف)، کلاس را انتخاب کنید. اگر این پایه چند کلاس دارد و هر کدام معلم جدا دارند، حتماً این فیلد را پر کنید — در غیر این صورت معلم روی تمام کلاس‌های این پایه دسترسی می‌گیرد.'
          }
        />
        <Select
          label="درس"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="انتخاب درس"
          options={subjects.map((s) => ({ value: s.id, label: s.title }))}
          helperText={
            subjects.length === 0
              ? 'هیچ درسی ثبت نشده است.'
              : 'برای پایه‌های ابتدایی که معلم تمام دروس را تدریس می‌کند، این فیلد را خالی بگذارید.'
          }
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
